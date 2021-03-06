import { ISdCliPackageBuildResult } from "../commons";
import { EventEmitter } from "events";
import { FsUtil, Logger, SdFsWatcher } from "@simplysm/sd-core-node";
import path from "path";
import { SdCliPackageLinter } from "../build-tool/SdCliPackageLinter";

export class SdCliJsLibBuilder extends EventEmitter {
  private readonly _logger = Logger.get(["simplysm", "sd-cli", this.constructor.name]);

  private readonly _linter: SdCliPackageLinter;

  public constructor(private readonly _rootPath: string) {
    super();
    this._linter = new SdCliPackageLinter(this._rootPath);
  }

  public override on(event: "change", listener: () => void): this;
  public override on(event: "complete", listener: (results: ISdCliPackageBuildResult[]) => void): this;
  public override on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public async watchAsync(): Promise<void> {
    this.emit("change");

    const relatedPaths = await this.getRelatedPathsAsync();
    const watcher = SdFsWatcher.watch(relatedPaths);
    watcher.onChange({}, async (changedInfos) => {
      const changeFilePaths = changedInfos.filter((item) => ["add", "change", "unlink"].includes(item.event)).map((item) => item.path);
      if (changeFilePaths.length === 0) return;

      this._logger.debug("파일 변경 감지");
      this.emit("change");
      const watchBuildResults: ISdCliPackageBuildResult[] = [];

      const lintFilePaths = changedInfos.filter((item) => ["add", "change"].includes(item.event)).map((item) => item.path);
      if (lintFilePaths.length > 0) {
        watchBuildResults.push(...await this._linter.lintAsync(lintFilePaths));
      }

      const watchRelatedPaths = await this.getRelatedPathsAsync();
      watcher.add(watchRelatedPaths);

      this.emit("complete", watchBuildResults);
    });

    // 빌드
    const buildResults = await this._linter.lintAsync(relatedPaths);

    this.emit("complete", buildResults);
  }

  public async buildAsync(): Promise<ISdCliPackageBuildResult[]> {
    const relatedPaths = await this.getRelatedPathsAsync();
    return await this._linter.lintAsync(relatedPaths);
  }

  private async getRelatedPathsAsync(): Promise<string[]> {
    const mySourceGlobPath = path.resolve(this._rootPath, "**", "+(*.js|*.cjs|*.mjs)");
    const mySourceFilePaths = await FsUtil.globAsync(mySourceGlobPath, {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.*/**"
      ]
    });

    return [...mySourceFilePaths, path.resolve(this._rootPath, ".eslintrc.cjs")].distinct();
  }
}
