import { FsUtil, Logger, SdProcess } from "@simplysm/sd-core-node";
import path from "path";
import { INpmConfig, ISdCliConfig, ISdCliPackageBuildResult } from "../commons";
import { SdCliPackage } from "../packages/SdCliPackage";
import { JsonConvert, Wait } from "@simplysm/sd-core-common";
import os from "os";
import { SdCliBuildResultUtil } from "../utils/SdCliBuildResultUtil";
import semver from "semver/preload";
import { SdCliConfigUtil } from "../utils/SdCliConfigUtil";
import { SdCliLocalUpdate } from "./SdCliLocalUpdate";
import { fileURLToPath } from "url";
import cp from "child_process";

export class SdCliProject {
  private readonly _logger = Logger.get(["simplysm", "sd-cli", this.constructor.name]);

  private readonly _npmConfig: INpmConfig;
  private readonly _serverInfoMap = new Map<string, IServerInfo>();

  public constructor(private readonly _rootPath: string) {
    const npmConfigFilePath = path.resolve(this._rootPath, "package.json");
    this._npmConfig = FsUtil.readJson(npmConfigFilePath);
  }

  public async watchAsync(opt: { confFileRelPath: string; optNames: string[]; pkgs: string[] }): Promise<void> {
    this._logger.debug("프로젝트 설정 가져오기...");
    const config = await SdCliConfigUtil.loadConfigAsync(path.resolve(this._rootPath, opt.confFileRelPath), true, opt.optNames);

    if (config.localUpdates) {
      this._logger.debug("로컬 라이브러리 업데이트 변경감지 시작...");
      await new SdCliLocalUpdate(this._rootPath).watchAsync({ confFileRelPath: opt.confFileRelPath });
    }

    this._logger.debug("패키지 목록 구성...");
    const allPkgs = await this._getPackagesAsync(config);
    const pkgs = allPkgs.filter((pkg) => opt.pkgs.length === 0 || opt.pkgs.includes(path.basename(pkg.rootPath)));

    this._logger.debug("패키지 이벤트 설정...");
    let changeCount = 0;
    let changePkgs: SdCliPackage[] = [];
    const totalResultMap = new Map<string, ISdCliPackageBuildResult[]>();
    for (const pkg of pkgs) {
      pkg
        .on("change", () => {
          if (changeCount === 0) {
            this._logger.log("빌드를 시작합니다...");
          }
          changeCount++;
          this._logger.debug(`[${pkg.name}] 빌드를 시작합니다...`);
        })
        .on("complete", (results) => {
          changePkgs.push(pkg);

          this._logger.debug(`[${pkg.name}] 빌드가 완료되었습니다.`);
          totalResultMap.set(pkg.name, results);

          setTimeout(async () => {
            changeCount--;
            if (changeCount === 0) {
              const currChangePkgs = [...changePkgs].distinct(true);
              changePkgs = [];

              for (const changePkg of currChangePkgs) {
                if (changePkg.config.type === "server" && !results.some((item) => item.severity === "error")) {
                  await this._restartServerAsync(changePkg);
                }

                if (changePkg.config.type === "client") {
                  if (typeof changePkg.config.server === "string") {
                    const serverInfo = this._serverInfoMap.get(changePkg.config.server);
                    if (serverInfo) {
                      await this._sendServerWorkerBroadcastReloadAsync(serverInfo);
                    }
                  }
                  else {
                    const serverInfo = this._serverInfoMap.get("PORT:" + changePkg.config.server.port);
                    if (serverInfo) {
                      await this._sendServerWorkerBroadcastReloadAsync(serverInfo);
                    }
                  }
                }
              }

              this._loggingResults(totalResultMap);
              this._loggingOpenClientHrefs();
              this._logger.info("모든 빌드가 완료되었습니다.");
            }
          }, 500);
        });
    }


    if (changeCount === 0) {
      this._logger.log("빌드를 시작합니다...");
    }
    changeCount++;

    try {
      const pkgNames = pkgs.map((item) => item.name);
      const buildCompletedPackageNames: string[] = [];
      await pkgs.parallelAsync(async (pkg) => {
        await Wait.until(() => !pkg.allDependencies.some((dep) => pkgNames.includes(dep) && !buildCompletedPackageNames.includes(dep)));
        if (pkg.config.type === "client") {
          await pkg.watchAsync();

          if (typeof pkg.config.server === "string") {
            const serverInfo = this._serverInfoMap.getOrCreate(pkg.config.server, { pathProxy: [], clientInfos: [] });

            serverInfo.pathProxy.push({
              from: pkg.name.split("/").last()!,
              to: path.resolve(pkg.rootPath, "dist")
            });
            await this._reloadServerWorkerPathProxyAsync(serverInfo);

            serverInfo.clientInfos.push({
              pkgKey: pkg.name.split("/").last()!,
              platforms: pkg.config.builder ? Object.keys(pkg.config.builder) : ["web"],
              cordovaTargets: pkg.config.builder?.cordova?.target ? Object.keys(pkg.config.builder.cordova.target) : ["browser"]
            });
          }
          else { // DEV SERVER
            const serverInfo = this._serverInfoMap.getOrCreate("PORT:" + pkg.config.server.port, {
              pathProxy: [],
              clientInfos: []
            });
            if (serverInfo.worker === undefined) {
              const serverWorkerInfo = await this._runServerWorkerAsync(pkg.config.server);
              serverInfo.worker = serverWorkerInfo.worker;
              serverInfo.url = serverWorkerInfo.url;

              serverInfo.pathProxy.push({
                from: pkg.name.split("/").last()!,
                to: path.resolve(pkg.rootPath, "dist")
              });
              await this._reloadServerWorkerPathProxyAsync(serverInfo);

              serverInfo.clientInfos.push({
                pkgKey: pkg.name.split("/").last()!,
                platforms: pkg.config.builder ? Object.keys(pkg.config.builder) : ["web"],
                cordovaTargets: pkg.config.builder?.cordova?.target ? Object.keys(pkg.config.builder.cordova.target) : ["browser"]
              });
            }
          }
        }
        else {
          await pkg.watchAsync();
        }
        buildCompletedPackageNames.push(pkg.name);
      });
    }
    catch (err) {
      this._loggingResults(totalResultMap);
      this._loggingOpenClientHrefs();
      throw err;
    }

    changeCount--;
    if (changeCount === 0) {
      this._loggingResults(totalResultMap);
      this._loggingOpenClientHrefs();
      this._logger.info("모든 빌드가 완료되었습니다.");
    }
  }

  public async buildAsync(opt: { confFileRelPath: string; optNames: string[]; pkgs: string[] }): Promise<void> {
    this._logger.debug("프로젝트 설정 가져오기...");
    const config = await SdCliConfigUtil.loadConfigAsync(path.resolve(this._rootPath, opt.confFileRelPath), false, opt.optNames);

    this._logger.debug("패키지 목록 구성...");
    const allPkgs = await this._getPackagesAsync(config);
    const pkgs = allPkgs.filter((pkg) => opt.pkgs.length === 0 || opt.pkgs.includes(path.basename(pkg.rootPath)));

    this._logger.debug("프로젝트 및 패키지 버전 설정...");
    await this._upgradeVersionAsync(allPkgs);

    // 빌드
    await this._buildPkgsAsync(pkgs);
  }

  public async publishAsync(opt: { noBuild: boolean; confFileRelPath: string; optNames: string[]; pkgs: string[] }): Promise<void> {
    this._logger.debug("프로젝트 설정 가져오기...");
    const config = await SdCliConfigUtil.loadConfigAsync(path.resolve(this._rootPath, opt.confFileRelPath), false, opt.optNames);

    if (opt.noBuild) {
      this._logger.warn("빌드하지 않고, 배포하는것은 상당히 위험합니다.");
      await this._waitSecMessageAsync("프로세스를 중지하려면, 'CTRL+C'를 누르세요.", 5);
    }

    // GIT 사용중일 경우, 커밋되지 않은 수정사항이 있는지 확인
    if (FsUtil.exists(path.resolve(process.cwd(), ".git"))) {
      this._logger.debug("GIT 커밋여부 확인...");
      const gitStatusResult = await SdProcess.spawnAsync("git status");
      if (gitStatusResult.includes("Changes") || gitStatusResult.includes("Untracked")) {
        throw new Error("커밋되지 않은 정보가 있습니다.\n" + gitStatusResult);
      }
    }

    this._logger.debug("패키지 목록 구성...");
    const allPkgs = await this._getPackagesAsync(config);
    const pkgs = allPkgs.filter((pkg) => opt.pkgs.length === 0 || opt.pkgs.includes(path.basename(pkg.rootPath)));

    this._logger.debug("프로젝트 및 패키지 버전 설정...");
    await this._upgradeVersionAsync(allPkgs);

    // 빌드
    if (!opt.noBuild) {
      // this._logger.debug("노드패키지 업데이트...");
      // await new SdCliNpm(this._rootPath).updateAsync();

      this._logger.debug("빌드를 시작합니다...");
      await this._buildPkgsAsync(pkgs);
    }

    // GIT 사용중일경우, 새 버전 커밋 및 TAG 생성
    if (FsUtil.exists(path.resolve(process.cwd(), ".git"))) {
      this._logger.debug("새 버전 커밋 및 TAG 생성...");
      await SdProcess.spawnAsync("git add .");
      await SdProcess.spawnAsync(`git commit -m "v${this._npmConfig.version}"`);
      await SdProcess.spawnAsync(`git tag -a "v${this._npmConfig.version}" -m "v${this._npmConfig.version}"`);

      this._logger.debug("새 버전 푸쉬...");
      await SdProcess.spawnAsync("git push");
      await SdProcess.spawnAsync("git push --tags");
    }

    this._logger.debug("배포 시작...");
    await pkgs.parallelAsync(async (pkg) => {
      if (pkg.config.publish == null) return;

      this._logger.debug(`[${pkg.name}] 배포를 시작합니다...`);
      await pkg.publishAsync();
      this._logger.debug(`[${pkg.name}] 배포가 완료되었습니다.`);
    });
    this._logger.info(`모든 배포가 완료되었습니다. (v${this._npmConfig.version})`);
  }

  private async _runServerWorkerAsync(filePathOrOpt: string | { port: number }): Promise<{ worker: cp.ChildProcess; url: string }> {
    const workerPath = fileURLToPath(await import.meta.resolve!("../worker/server-worker"));
    return await new Promise<{ worker: cp.ChildProcess; url: string }>((resolve, reject) => {
      const worker = cp.fork(workerPath, [
        JsonConvert.stringify(filePathOrOpt)
      ], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: process.env
      });

      worker.on("error", (err) => {
        reject(err);
      });

      worker.stdout!.pipe(process.stdout);
      worker.stderr!.pipe(process.stderr);

      worker.on("message", (url: string) => {
        resolve({ worker, url });
      });
    });
  }

  private async _reloadServerWorkerPathProxyAsync(serverInfo: IServerInfo): Promise<void> {
    if (!serverInfo.worker) return;

    await new Promise<void>((resolve, reject) => {
      serverInfo.worker!.send(JsonConvert.stringify(serverInfo.pathProxy), (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async _sendServerWorkerBroadcastReloadAsync(serverInfo: IServerInfo): Promise<void> {
    if (!serverInfo.worker) return;

    await new Promise<void>((resolve, reject) => {
      serverInfo.worker!.send("broadcastReload", (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private _isServerRestarting = false;

  private async _restartServerAsync(pkg: SdCliPackage): Promise<void> {
    await Wait.until(() => !this._isServerRestarting);

    this._isServerRestarting = true;
    const entryFileRelPath = pkg.main;
    if (entryFileRelPath === undefined) {
      this._logger.error(`서버패키지(${pkg.name})의 'package.json'에서 'main'필드를 찾을 수 없습니다.`);
      this._isServerRestarting = false;
      return;
    }
    const entryFilePath = path.resolve(pkg.rootPath, entryFileRelPath);

    try {
      const serverInfo = this._serverInfoMap.getOrCreate(path.basename(pkg.rootPath), {
        pathProxy: [],
        clientInfos: []
      });
      if (serverInfo.worker) {
        this._logger.log(`[${pkg.name}] 기존 서버 중지...`);
        cp.exec(`taskkill /pid ${serverInfo.worker.pid} /F /T`);
        delete serverInfo.worker;
        delete serverInfo.url;
      }

      this._logger.log(`[${pkg.name}] 서버 시작중...`);

      const serverWorkerInfo = await this._runServerWorkerAsync(entryFilePath);
      serverInfo.worker = serverWorkerInfo.worker;
      serverInfo.url = serverWorkerInfo.url;
      await this._reloadServerWorkerPathProxyAsync(serverInfo);

      this._logger.log(`[${pkg.name}] 서버가 시작되었습니다.`);
    }
    catch (err) {
      this._logger.error(`서버(${pkg.name}) 재시작중 오류 발생`, err);
    }

    this._isServerRestarting = false;
  }

  private async _buildPkgsAsync(pkgs: SdCliPackage[]): Promise<void> {
    this._logger.debug("빌드를 시작합니다...");
    const pkgNames = pkgs.map((item) => item.name);
    const buildCompletedPackageNames: string[] = [];
    const totalResultMap = new Map<string, ISdCliPackageBuildResult[]>();
    try {
      await pkgs.parallelAsync(async (pkg) => {
        await Wait.until(() => !pkg.allDependencies.some((dep) => pkgNames.includes(dep) && !buildCompletedPackageNames.includes(dep)));

        this._logger.debug(`[${pkg.name}] 빌드를 시작합니다...`);
        totalResultMap.set(pkg.name, await pkg.buildAsync());
        this._logger.debug(`[${pkg.name}] 빌드가 완료되었습니다.`);

        buildCompletedPackageNames.push(pkg.name);
      });

      this._loggingResults(totalResultMap);
      if (Array.from(totalResultMap.values()).mapMany().some((item) => item.severity === "error")) {
        throw new Error("빌드중 오류가 발생하였습니다.");
      }
      else {
        this._logger.info("모든 빌드가 완료되었습니다.");
      }
    }
    catch (err) {
      this._loggingResults(totalResultMap);
      throw err;
    }
  }

  private async _upgradeVersionAsync(pkgs: SdCliPackage[]): Promise<void> {
    // 작업공간 package.json 버전 설정
    const newVersion = semver.inc(this._npmConfig.version, "patch")!;
    this._npmConfig.version = newVersion;

    const pkgNames = pkgs.map((item) => item.name);

    const updateDepVersion = (deps: Record<string, string> | undefined): void => {
      if (!deps) return;
      for (const depName of Object.keys(deps)) {
        if (pkgNames.includes(depName)) {
          deps[depName] = newVersion;
        }
      }
    };
    updateDepVersion(this._npmConfig.dependencies);
    updateDepVersion(this._npmConfig.optionalDependencies);
    updateDepVersion(this._npmConfig.devDependencies);
    updateDepVersion(this._npmConfig.peerDependencies);

    const npmConfigFilePath = path.resolve(this._rootPath, "package.json");
    await FsUtil.writeJsonAsync(npmConfigFilePath, this._npmConfig, { space: 2 });

    // 각 패키지 package.json 버전 설정
    await pkgs.parallelAsync(async (pkg) => {
      await pkg.setNewVersionAsync(newVersion, pkgNames);
    });
  }

  private async _waitSecMessageAsync(msg: string, sec: number): Promise<void> {
    for (let i = sec; i > 0; i--) {
      if (i !== sec) {
        process.stdout.cursorTo(0);
      }
      process.stdout.write(`${msg} ${i}`);
      await Wait.time(1000);
    }

    process.stdout.cursorTo(0);
    process.stdout.clearLine(0);
  }

  private async _getPackagesAsync(conf: ISdCliConfig): Promise<SdCliPackage[]> {
    const pkgRootPaths = await this._npmConfig.workspaces?.mapManyAsync(async (item) => await FsUtil.globAsync(item));
    if (!pkgRootPaths) {
      throw new Error("최상위 'package.json'에서 'workspaces'를 찾을 수 없습니다.");
    }

    return pkgRootPaths.map((pkgRootPath) => {
      // if (pkgs.length > 0 && !pkgs.includes(path.basename(pkgRootPath))) return undefined;
      const pkgConfig = conf.packages[path.basename(pkgRootPath)];
      if (!pkgConfig) return undefined;
      return new SdCliPackage(this._rootPath, pkgRootPath, pkgConfig);
    }).filterExists();
  }

  private _loggingResults(totalResultMap: Map<string, ISdCliPackageBuildResult[]>): void {
    const totalResults = Array.from(totalResultMap.entries())
      .mapMany((item) => item[1].map((item1) => ({
        pkgName: item[0],
        ...item1
      })))
      .orderBy((item) => `${item.pkgName}_${item.filePath}`);

    const warnings = totalResults
      .filter((item) => item.severity === "warning")
      .map((item) => `${SdCliBuildResultUtil.getMessage(item)} (${item.pkgName})`)
      .distinct();

    const errors = totalResults
      .filter((item) => item.severity === "error")
      .map((item) => `${SdCliBuildResultUtil.getMessage(item)} (${item.pkgName})`)
      .distinct();

    if (warnings.length > 0) {
      this._logger.warn(`경고 발생${os.EOL}`, warnings.join(os.EOL));
    }
    if (errors.length > 0) {
      this._logger.error(`오류 발생${os.EOL}`, errors.join(os.EOL));
    }

    if (errors.length > 0) {
      this._logger.error(`경고: ${warnings.length}건, 오류: ${errors.length}건`);
    }
    else if (warnings.length > 0) {
      this._logger.warn(`경고: ${warnings.length}건, 오류: ${errors.length}건`);
    }
  }

  private _loggingOpenClientHrefs(): void {
    const clientHrefs: string[] = [];

    const serverInfos = Array.from(this._serverInfoMap.values());
    for (const serverInfo of serverInfos) {
      if (!serverInfo.worker) continue;

      /*const protocolStr = serverInfo.server.options.ssl ? "https" : "http";
      const portStr = serverInfo.server.options.port.toString();*/

      for (const clientInfo of serverInfo.clientInfos) {
        for (const platform of clientInfo.platforms) {
          if (platform === "web") {
            clientHrefs.push(`${serverInfo.url}/${clientInfo.pkgKey}/`);
          }
          else if (platform === "electron") {
            clientHrefs.push(`sd-cli run-electron ${clientInfo.pkgKey} ${serverInfo.url}`);
          }
          else if (platform === "cordova") {
            for (const target of clientInfo.cordovaTargets) {
              if (target === "browser") {
                clientHrefs.push(`${serverInfo.url}/${clientInfo.pkgKey}/${platform}/`);
              }
              else {
                clientHrefs.push(`sd-cli run-cordova ${target} ${clientInfo.pkgKey} ${serverInfo.url}`);
              }
            }
          }
        }
      }
    }
    if (clientHrefs.length > 0) {
      this._logger.log(`오픈된 클라이언트:\n${clientHrefs.join("\n")}`);
    }
  }
}

interface IServerInfo {
  worker?: cp.ChildProcess;
  url?: string;
  pathProxy: { from: string; to: string }[];
  clientInfos: { pkgKey: string; platforms: string[]; cordovaTargets: string[] }[];
}
