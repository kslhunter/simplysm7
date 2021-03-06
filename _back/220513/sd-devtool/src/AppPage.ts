import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { SdServiceFactoryRootProvider, SdToastProvider } from "@simplysm/sd-angular";

import { FsUtil, SdProcess } from "@simplysm/sd-core-node";
import { appIcons } from "./app-icons";
import { Wait } from "@simplysm/sd-core-common";
import { SdAutoUpdateServiceClient } from "@simplysm/sd-service-client";
import path from "path";
import * as remote from "@electron/remote";

@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sdm-busy-container [busy]="busyCount > 0">
      <sdm-topbar-container>
        <sdm-topbar>
          <div class="sd-padding-sm-0" style="height: 90%;">
            <img *ngIf="(logo | async) as src" [src]="src" style="height: 100%; filter: grayscale(100%); opacity: .3;"/>
          </div>

          <sdm-topbar-menu class="_topbar-menu-item" *ngIf="latestVersion && latestVersion !== version"
                           (click)="onUpdateButtonClick()">
            <fa-icon [icon]="icons.update | async" [fixedWidth]="true"></fa-icon>
          </sdm-topbar-menu>
        </sdm-topbar>

        <sd-pane class="sd-padding-default">
          <sdm-card class="sd-padding-lg">
            <h4>
              NVM 설정
              <sd-anchor (click)="onNvmRefreshButtonClick()">
                <fa-icon [icon]="icons.refresh | async" [fixedWidth]="true"></fa-icon>
              </sd-anchor>
            </h4>
            <sd-gap height="xl"></sd-gap>

            <sdm-list>
              <ng-container *ngFor="let nvmVersion of nvm.versions">
                <sd-list-item (click)="onNvmVersionClick(nvmVersion)"
                              [style.fontWeight]="nvmVersion === nvm.currentVersion ? 'bold' : undefined">
                  {{ nvmVersion }}
                  <fa-icon [icon]="icons.check | async" [fixedWidth]="true"
                           *ngIf="nvmVersion === nvm.currentVersion"></fa-icon>
                </sd-list-item>
              </ng-container>
            </sdm-list>
          </sdm-card>
        </sd-pane>
      </sdm-topbar-container>
    </sdm-busy-container>`,
  styles: [/* language=SCSS */ `
    :host {
      ._topbar-menu-item {
        color: var(--theme-color-warning-light);

        &:hover {
          color: var(--theme-color-warning-default);
        }

        &:active {
          color: var(--theme-color-warning-dark);
        }
      }
    }
  `]
})
export class AppPage implements OnInit {
  public icons = appIcons;

  // @ts-expect-error
  public logo = import("../res/logo-landscape.png").then(m => m.default);

  public busyCount = 0;

  public nvm: {
    versions: string[];
    currentVersion?: string;
  } = {
    versions: []
  };

  public version = process.env["SD_VERSION"];
  public latestVersion?: string;

  public constructor(private readonly _toast: SdToastProvider,
                     private readonly _cdr: ChangeDetectorRef,
                     private readonly _serviceFactory: SdServiceFactoryRootProvider) {
    document.documentElement.style.setProperty("--background-color", "var(--color-blue-grey-50)");
  }

  public async ngOnInit(): Promise<void> {
    this.busyCount++;
    await this._toast.try(async () => {
      const autoUpdateService = new SdAutoUpdateServiceClient(this._serviceFactory.get("MAIN"));
      this.latestVersion = await autoUpdateService.getLastVersionAsync("sd-devtool", "electron");

      await this._nvmRefreshAsync();
    });

    this.busyCount--;
    this._cdr.markForCheck();
  }

  public async onUpdateButtonClick(): Promise<void> {
    this.busyCount++;
    await this._toast.try(async () => {
      const serviceClient = this._serviceFactory.get("MAIN");
      const buffer = await serviceClient.downloadAsync(`/sd-devtool/electron/updates/${this.latestVersion}.exe`);

      const distPath = path.resolve(remote.app.getPath("temp"), `@simplysm/sd-devtool/updates/${this.latestVersion}.exe`);
      await FsUtil.mkdirsAsync(path.dirname(distPath));
      await FsUtil.writeFileAsync(distPath, buffer);

      await SdProcess.spawnAsync(`"${distPath}"`, { detached: true });
    });

    this.busyCount--;
    this._cdr.markForCheck();
  }

  public async onNvmRefreshButtonClick(): Promise<void> {
    this.busyCount++;
    await this._toast.try(async () => {
      await this._nvmRefreshAsync();
    });

    this.busyCount--;
    this._cdr.markForCheck();
  }

  public async onNvmVersionClick(nvmVersion: string): Promise<void> {
    this.busyCount++;
    await this._toast.try(async () => {
      await SdProcess.spawnAsync(`powershell start-process -windowstyle hidden -verb runas 'nvm' 'use ${nvmVersion}'`);
      await Wait.time(300);
      await this._nvmRefreshAsync();
    });

    this.busyCount--;
    this._cdr.markForCheck();
  }

  private async _nvmRefreshAsync(): Promise<void> {
    const result = await SdProcess.spawnAsync("nvm list", undefined);
    this.nvm = {
      versions: result.match(/[0-9]*\.[0-9]*\.[0-9]*/g) ?? [],
      currentVersion: result.match(/\* [0-9]*\.[0-9]*\.[0-9]*/g)?.[0]?.slice(2)
    };
  }
}
