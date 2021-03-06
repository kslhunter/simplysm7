import { INpmConfig, ISdCliLibPackageConfig, ISdCliPackageBuildResult } from "../commons";
import { EventEmitter } from "events";
import ts from "typescript";
import { FsUtil, Logger, PathUtil, SdFsWatcher } from "@simplysm/sd-core-node";
import path from "path";
import { createHash } from "crypto";
import { SdCliBuildResultUtil } from "../utils/SdCliBuildResultUtil";
import { NgtscProgram } from "@angular/compiler-cli";
import sass from "sass";
import { SdCliPackageLinter } from "../build-tool/SdCliPackageLinter";
import { SdCliCacheCompilerHost } from "../build-tool/SdCliCacheCompilerHost";
import { SdCliNgCacheCompilerHost } from "../build-tool/SdCliNgCacheCompilerHost";
import { NgCompiler } from "@angular/compiler-cli/src/ngtsc/core";
import { SdCliNpmConfigUtil } from "../utils/SdCliNpmConfigUtil";
import { SdCliNgModuleGenerator } from "../ng-tools/SdCliNgModuleGenerator";
import { SdCliIndexFileGenerator } from "../build-tool/SdCliIndexFileGenerator";

export class SdCliTsLibBuilder extends EventEmitter {
  private readonly _logger: Logger;

  private _moduleResolutionCache?: ts.ModuleResolutionCache;

  private readonly _linter: SdCliPackageLinter;

  private readonly _fileCache = new Map<string, IFileCache>();
  private readonly _writeFileCache = new Map<string, string>();

  private readonly _indexFileGenerator?: SdCliIndexFileGenerator;

  private _program?: ts.Program;
  private _ngProgram?: NgtscProgram;
  private _builder?: ts.EmitAndSemanticDiagnosticsBuilderProgram;
  private readonly _ngModuleGenerator?: SdCliNgModuleGenerator;

  private readonly _tsconfigFilePath: string;
  private readonly _parsedTsconfig: ts.ParsedCommandLine;
  private readonly _npmConfigMap = new Map<string, INpmConfig>();

  private readonly _isAngular: boolean;
  private readonly _hasAngularRoute: boolean;

  public constructor(private readonly _rootPath: string,
                     private readonly _config: ISdCliLibPackageConfig,
                     private readonly _projRootPath: string) {
    super();
    const npmConfig = this._getNpmConfig(this._rootPath)!;

    // linter
    this._linter = new SdCliPackageLinter(this._rootPath);

    // logger
    this._logger = Logger.get(["simplysm", "sd-cli", this.constructor.name, npmConfig.name]);

    // isAngular
    this._isAngular = SdCliNpmConfigUtil.getDependencies(npmConfig).defaults.includes("@angular/core");
    this._hasAngularRoute = SdCliNpmConfigUtil.getDependencies(npmConfig).defaults.includes("@angular/router");

    // tsconfig
    this._tsconfigFilePath = path.resolve(this._rootPath, "tsconfig-build.json");
    const tsconfig = FsUtil.readJson(this._tsconfigFilePath);
    this._parsedTsconfig = ts.parseJsonConfigFileContent(tsconfig, ts.sys, this._rootPath, this._isAngular ? tsconfig.angularCompilerOptions : undefined);

    if (this._isAngular) {
      // NgModule ????????? ?????????
      this._ngModuleGenerator = new SdCliNgModuleGenerator(this._rootPath, [
        "controls",
        "directives",
        "guards",
        "modals",
        "providers",
        "app",
        "pages",
        "print-templates",
        "toasts",
        "AppPage"
      ], this._hasAngularRoute ? {
        glob: "**/*Page.ts",
        fileEndsWith: "Page",
        rootClassName: "AppPage"
      } : undefined);
    }

    // index ????????? ?????????
    if (this._config.autoIndex) {
      this._indexFileGenerator = new SdCliIndexFileGenerator(this._rootPath, this._config.autoIndex);
    }
  }

  public override on(event: "change", listener: () => void): this;
  public override on(event: "complete", listener: (results: ISdCliPackageBuildResult[]) => void): this;
  public override on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public async watchAsync(): Promise<void> {
    this.emit("change");

    this._logger.debug("dist ?????? ??????...");
    await FsUtil.removeAsync(this._parsedTsconfig.options.outDir!);

    if (this._ngModuleGenerator) {
      this._logger.debug("NgModule ??????...");
      await this._ngModuleGenerator.runAsync();
    }

    if (this._indexFileGenerator) {
      this._logger.debug("index.js ?????? ??? index.js??? ???????????? ??????...");
      await this._indexFileGenerator.runAsync();
      await this._indexFileGenerator.watchAsync();
    }

    this._logger.debug("???????????? ??????...");
    const buildPack = this._createSdBuildPack(this._parsedTsconfig);

    this._logger.debug("???????????? ??????...");
    const relatedPaths = await this.getAllRelatedPathsAsync();
    const watcher = SdFsWatcher.watch(relatedPaths);
    watcher.onChange({}, async (changedInfos) => {
      const changeFilePaths = changedInfos.filter((item) => ["add", "change", "unlink"].includes(item.event)).map((item) => item.path);
      if (changeFilePaths.length === 0) return;

      this._logger.debug("?????? ?????? ??????", changeFilePaths);
      this.emit("change");

      this._logger.debug("????????? ????????? ?????? ??????...");
      for (const changeFilePath of changeFilePaths) {
        const fileCache = this._fileCache.get(PathUtil.posix(changeFilePath));
        if (fileCache) {
          if (fileCache.importerSet) {
            for (const importer of fileCache.importerSet.values()) {
              this._fileCache.delete(importer);
            }
          }

          this._fileCache.delete(PathUtil.posix(changeFilePath));
        }
      }

      if (this._ngModuleGenerator) {
        this._logger.debug("NgModule ??????...");
        this._ngModuleGenerator.removeCaches(changeFilePaths);
        await this._ngModuleGenerator.runAsync();
      }

      const watchBuildResults: ISdCliPackageBuildResult[] = [];

      this._logger.debug("???????????? ??????...");
      const watchBuildPack = this._createSdBuildPack(this._parsedTsconfig);

      const promises: Promise<ISdCliPackageBuildResult[]>[] = [];

      // ??????
      promises.push(this._runBuilderAsync(watchBuildPack.builder, watchBuildPack.ngCompiler));
      // watchBuildResults.push(...await this._runBuilderAsync(watchBuildPack.builder, watchBuildPack.ngCompiler));

      // ??????
      const lintFilePaths = [
        ...watchBuildPack.affectedSourceFiles.map((item) => item.fileName),
        ...changedInfos.filter((item) => ["add", "change"].includes(item.event)).map((item) => item.path)
      ];
      if (lintFilePaths.length > 0) {
        promises.push(this._linter.lintAsync(lintFilePaths, watchBuildPack.program));
        // watchBuildResults.push(...await this._linter.lintAsync(lintFilePaths, watchBuildPack.program));
      }

      this._logger.debug("??????...");
      watchBuildResults.push(...(await Promise.all(promises)).mapMany());

      this._logger.debug("???????????? ???????????? ?????????...");
      const watchRelatedPaths = await this.getAllRelatedPathsAsync();
      watcher.add(watchRelatedPaths);

      this.emit("complete", watchBuildResults);
    });

    this._logger.debug("??????...");
    const buildResults = (await Promise.all([
      this._runBuilderAsync(buildPack.builder, buildPack.ngCompiler),
      this._linter.lintAsync(relatedPaths, buildPack.program)
    ].filterExists())).mapMany();

    this._logger.debug("???????????? ???????????? ?????????...");
    const watchRelatedPaths = await this.getAllRelatedPathsAsync();
    watcher.add(watchRelatedPaths);

    this.emit("complete", buildResults);
  }

  public async buildAsync(): Promise<ISdCliPackageBuildResult[]> {
    this._logger.debug("dist ?????? ??????...");
    await FsUtil.removeAsync(this._parsedTsconfig.options.outDir!);

    if (this._ngModuleGenerator) {
      this._logger.debug("NgModule ??????...");
      await this._ngModuleGenerator.runAsync();
    }

    if (this._indexFileGenerator) {
      this._logger.debug("index.js ??????...");
      await this._indexFileGenerator.runAsync();
    }

    this._logger.debug("???????????? ??????...");
    const buildPack = this._createSdBuildPack(this._parsedTsconfig);

    this._logger.debug("??????...");
    const relatedPaths = await this.getAllRelatedPathsAsync();
    return (await Promise.all([
      this._runBuilderAsync(buildPack.builder, buildPack.ngCompiler),
      this._linter.lintAsync(relatedPaths, buildPack.program)
    ].filterExists())).mapMany();
  }

  private async getAllRelatedPathsAsync(): Promise<string[]> {
    const projNpmConfig = this._getNpmConfig(this._projRootPath)!;
    const projName = projNpmConfig.name;

    const fileCachePaths = Array.from(this._fileCache.keys())
      .filter((filePath) => {
        const projRegex = new RegExp(`node_modules[\\\\/]@${projName}[\\\\/]`);
        return !filePath.includes("node_modules")
          || (/node_modules[\\/]@simplysm[\\/]/).test(filePath)
          || projRegex.test(filePath);
      });
    const mySourceGlobPath = path.resolve(this._rootPath, "**", "+(*.js|*.cjs|*.mjs|*.ts|*.scss)");
    const mySourceFilePaths = await FsUtil.globAsync(mySourceGlobPath, {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.*/**"
      ]
    });

    return [...fileCachePaths, ...mySourceFilePaths, path.resolve(this._rootPath, ".eslintrc.cjs")].distinct();
  }

  private async _runBuilderAsync(builder: ts.EmitAndSemanticDiagnosticsBuilderProgram, ngCompiler?: NgCompiler): Promise<ISdCliPackageBuildResult[]> {
    try {
      const results: ISdCliPackageBuildResult[] = [];

      const diagnostics: ts.Diagnostic[] = [];

      if (ngCompiler) {
        diagnostics.push(...ngCompiler.getOptionDiagnostics());
      }

      diagnostics.push(
        ...builder.getOptionsDiagnostics(),
        ...builder.getGlobalDiagnostics()
      );

      if (ngCompiler) {
        await ngCompiler.analyzeAsync();
      }

      for (const sourceFile of builder.getSourceFiles()) {
        if (ngCompiler?.ignoreForDiagnostics.has(sourceFile)) continue;

        diagnostics.push(
          ...builder.getSyntacticDiagnostics(sourceFile),
          ...builder.getSemanticDiagnostics(sourceFile)
        );

        if (
          ngCompiler &&
          !sourceFile.isDeclarationFile &&
          !ngCompiler.ignoreForEmit.has(sourceFile) &&
          !ngCompiler.incrementalDriver.safeToSkipEmit(sourceFile)
        ) {
          diagnostics.push(
            ...ngCompiler.getDiagnosticsForFile(sourceFile, 1)
          );
        }
      }

      results.push(
        ...diagnostics
          .filter((item) => [ts.DiagnosticCategory.Error, ts.DiagnosticCategory.Warning].includes(item.category))
          .map((item) => SdCliBuildResultUtil.convertFromTsDiag(item))
          .filterExists()
      );

      if (results.some((item) => item.severity === "error")) {
        return results;
      }

      const transformers = ngCompiler?.prepareEmit().transformers;
      for (const sourceFile of builder.getSourceFiles()) {
        if (ngCompiler?.ignoreForEmit.has(sourceFile)) continue;
        builder.emit(sourceFile, undefined, undefined, undefined, transformers);
      }

      return results;
    }
    catch (err) {
      if (err instanceof sass.Exception) {
        const matches = (/^(.*\.sd\.scss) ([0-9]*):([0-9]*)/).exec(err.sassStack)!;
        const filePath = path.resolve(matches[1].replace(/\.sd\.scss/, "").replace(/^\.:/, item => item.toUpperCase()));
        const scssLine = matches[2];
        const scssChar = matches[3];
        const message = err.sassMessage;

        return [{
          filePath,
          line: undefined,
          char: undefined,
          code: undefined,
          severity: "error",
          message: `?????????(${scssLine}:${scssChar}): ${message}\n${err.message}`
        }];
      }

      return [{
        filePath: undefined,
        line: undefined,
        char: undefined,
        code: undefined,
        severity: "error",
        message: err.stack
      }];
    }
  }

  private _createSdBuildPack(parsedTsconfig: ts.ParsedCommandLine): ISdBuildPack {
    const compilerHost = this._createCacheCompilerHost(parsedTsconfig);
    const { program, ngCompiler } = this._createProgram(parsedTsconfig, compilerHost);

    this._builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
      program,
      compilerHost,
      this._builder
    );

    const affectedSourceFileSet: Set<ts.SourceFile> = new Set<ts.SourceFile>();
    while (true) {
      const result = this._builder.getSemanticDiagnosticsOfNextAffectedFile(undefined, (sourceFile) => {
        // this._logger.debug(sourceFile.fileName + " SYNTAX ??????...");
        if (ngCompiler?.ignoreForDiagnostics.has(sourceFile) && sourceFile.fileName.endsWith(".ngtypecheck.ts")) {
          const orgFileName = sourceFile.fileName.slice(0, -15) + ".ts";
          const orgSourceFile = this._builder!.getSourceFile(orgFileName);
          if (orgSourceFile) {
            affectedSourceFileSet.add(orgSourceFile);
          }

          return true;
        }

        return false;
      });
      if (!result) break;

      // this._logger.debug((result.affected as ts.SourceFile).fileName + " SYNTAX ??????");
      affectedSourceFileSet.add(result.affected as ts.SourceFile);
    }

    return {
      program,
      ngCompiler,
      builder: this._builder,
      affectedSourceFiles: Array.from(affectedSourceFileSet.values())
    };
  }

  private _createProgram(parsedTsconfig: ts.ParsedCommandLine, compilerHost: ts.CompilerHost): { program: ts.Program; ngCompiler?: NgCompiler } {
    if (this._isAngular) {
      this._ngProgram = new NgtscProgram(
        parsedTsconfig.fileNames,
        parsedTsconfig.options,
        compilerHost,
        this._ngProgram
      );
      this._program = this._ngProgram.getTsProgram();

      this._configProgramSourceFileVersions(this._program);
      return {
        program: this._program,
        ngCompiler: this._ngProgram.compiler
      };
    }
    else {
      this._program = ts.createProgram(
        parsedTsconfig.fileNames,
        parsedTsconfig.options,
        compilerHost,
        this._program
      );

      this._configProgramSourceFileVersions(this._program);

      return { program: this._program };
    }
  }

  private _configProgramSourceFileVersions(program: ts.Program): void {
    const baseGetSourceFiles = program.getSourceFiles;
    program.getSourceFiles = function (...parameters) {
      const files: readonly (ts.SourceFile & { version?: string })[] = baseGetSourceFiles(...parameters);

      for (const file of files) {
        if (file.version === undefined) {
          file.version = createHash("sha256").update(file.text).digest("hex");
        }
      }

      return files;
    };
  }

  private _createCacheCompilerHost(parsedTsconfig: ts.ParsedCommandLine): ts.CompilerHost {
    if (!this._moduleResolutionCache) {
      this._moduleResolutionCache = ts.createModuleResolutionCache(this._rootPath, (s) => s, parsedTsconfig.options);
    }

    const compilerHost = SdCliCacheCompilerHost.create(
      parsedTsconfig,
      this._moduleResolutionCache,
      this._fileCache,
      this._writeFileCache
    );

    if (this._isAngular) {
      return SdCliNgCacheCompilerHost.wrap(compilerHost, this._fileCache);
    }
    else {
      return compilerHost;
    }
  }

  private _getNpmConfig(pkgPath: string): INpmConfig | undefined {
    if (!this._npmConfigMap.has(pkgPath)) {
      this._npmConfigMap.set(pkgPath, FsUtil.readJson(path.resolve(pkgPath, "package.json")));
    }
    return this._npmConfigMap.get(pkgPath);
  }
}

interface IFileCache {
  exists?: boolean;
  sourceFile?: ts.SourceFile;
  content?: string;
  styleContent?: string;
  importerSet?: Set<string>;
}

interface ISdBuildPack {
  program: ts.Program;
  ngCompiler?: NgCompiler;
  builder: ts.EmitAndSemanticDiagnosticsBuilderProgram;
  affectedSourceFiles: ts.SourceFile[];
}
