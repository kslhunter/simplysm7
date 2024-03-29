import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SdModalBase } from "../providers/SdModalProvider";
import { ISdSheetColumnConfigVM } from "../controls/SdSheetControl";
import { SdSheetColumnControl } from "../controls/SdSheetColumnControl";

@Component({
  selector: "sd-sheet-config-modal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-dock-container>
      <sd-pane class="sd-padding-default">
        <sd-sheet [items]="displayConfigs"
                  [trackByFn]="trackByKeyFn">
          <sd-sheet-column header="Fix" width.px="40">
            <ng-template #cell let-item="item">
              <div style="text-align: center">
                <sd-checkbox size="sm" [(value)]="item.fixed"></sd-checkbox>
              </div>
            </ng-template>
          </sd-sheet-column>
          <sd-sheet-column header="Order" width.px="40">
            <ng-template #cell let-item="item" let-index="index">
              <div class="sd-padding-xs-sm">
                <sd-anchor [disabled]="index === 0 || (!item.fixed && !!displayConfigs[index - 1].fixed)"
                           (click)="onDisplayOrderUpButtonClick(item)">
                  <fa-icon [icon]="icons.fasAngleUp | async" [fixedWidth]=true></fa-icon>
                </sd-anchor>
                <sd-anchor [disabled]="index === configs.length - 1 || (item.fixed && !displayConfigs[index + 1].fixed)"
                           (click)="onDisplayOrderDownButtonClick(item)">
                  <fa-icon [icon]="icons.fasAngleDown | async" [fixedWidth]=true></fa-icon>
                </sd-anchor>
              </div>
            </ng-template>
          </sd-sheet-column>
          <sd-sheet-column header="Group" resizable width.px="100">
            <ng-template #cell let-item="item">
              <!--<sd-textfield size="sm" inset [(value)]="item.header"></sd-textfield>-->
              <div class="sd-padding-xs-sm">
                {{ item.group }}
              </div>
            </ng-template>
          </sd-sheet-column>
          <sd-sheet-column header="Header" resizable width.px="100">
            <ng-template #cell let-item="item">
              <!--<sd-textfield size="sm" inset [(value)]="item.header"></sd-textfield>-->
              <div class="sd-padding-xs-sm">
                {{ item.header }}
              </div>
            </ng-template>
          </sd-sheet-column>
          <sd-sheet-column header="Width(px)" resizable width.px="60">
            <ng-template #cell let-item="item">
              <sd-textfield size="sm" inset [(value)]="item.widthPixel" type="number"
                            *ngIf="!!item.resizable"></sd-textfield>
            </ng-template>
          </sd-sheet-column>
          <sd-sheet-column header="Hidden" width.px="40">
            <ng-template #cell let-item="item">
              <div style="text-align: center">
                <sd-checkbox size="sm" [(value)]="item.hidden"
                             [icon]="icons.fasTimes | async" theme="danger"></sd-checkbox>
              </div>
            </ng-template>
          </sd-sheet-column>
        </sd-sheet>
      </sd-pane>

      <sd-dock position="bottom" class="sd-padding-sm-default sd-padding-top-0" style="text-align: right">
        <div style="float: left">
          <sd-button inline theme="warning" (click)="onInitButtonClick()" button.style="min-width: 100px;">Reset</sd-button>
        </div>
        <sd-button inline theme="success" (click)="onOkButtonClick()" button.style="min-width: 100px;">OK</sd-button>
        <sd-gap width="sm"></sd-gap>
        <sd-button inline (click)="onCancelButtonClick()" button.style="min-width: 100px;">Cancel</sd-button>
      </sd-dock>
    </sd-dock-container>`,
  styles: [/* language=SCSS */ `
  `]
})
export class SdSheetConfigModal extends SdModalBase<ISdSheetConfigModalInput, Record<string, ISdSheetColumnConfigVM>> {
  public icons = {
    fasAngleUp: import("@fortawesome/pro-solid-svg-icons/faAngleUp").then(m => m.faAngleUp),
    fasAngleDown: import("@fortawesome/pro-solid-svg-icons/faAngleDown").then(m => m.faAngleDown),
    fasTimes: import("@fortawesome/pro-solid-svg-icons/faTimes").then(m => m.faTimes)
  };

  public param!: ISdSheetConfigModalInput;

  public configs: IColumnConfigVM[] = [];

  public get displayConfigs(): IColumnConfigVM[] {
    return this.configs.orderBy((item) => item.displayOrder).orderBy((item) => (item.fixed ? -1 : 0));
  }

  public trackByKeyFn = (index: number, item: any): any => item.key;

  public sdOnOpen(param: ISdSheetConfigModalInput): void {
    this.param = param;

    const configObj = param.configObj ?? {};

    let lastDisplayOrder = 0;
    const configs: IColumnConfigVM[] = [];
    for (const columnControl of param.controls) {
      if (columnControl.key !== undefined) {
        const columnConfig = configObj[columnControl.key];

        lastDisplayOrder += 1;
        lastDisplayOrder = columnConfig?.displayOrder ?? lastDisplayOrder;

        configs.push({
          key: columnControl.key,
          group: columnConfig?.group ?? columnControl.group,
          header: columnConfig?.header ?? columnControl.header,
          fixed: columnConfig?.fixed ?? columnControl.fixed ?? false,
          displayOrder: lastDisplayOrder,
          widthPixel: columnConfig?.widthPixel ?? columnControl.widthPixel,
          hidden: columnConfig?.hidden ?? columnControl.hidden === true,
          resizable: columnControl.resizable === true
        });
      }
    }

    const orderedItems = configs.orderBy((item) => item.displayOrder).orderBy((item) => (item.fixed ? -1 : 0));
    for (let i = 0; i < orderedItems.length; i++) {
      orderedItems[i].displayOrder = i;
    }

    this.configs = orderedItems;
  }

  public onDisplayOrderUpButtonClick(item: IColumnConfigVM): void {
    const displayConfigs = this.displayConfigs;

    const index = displayConfigs.indexOf(item);
    const prevItem = displayConfigs[index - 1];
    const temp = item.displayOrder;
    item.displayOrder = prevItem.displayOrder;
    prevItem.displayOrder = temp;
  }

  public onDisplayOrderDownButtonClick(item: IColumnConfigVM): void {
    const displayConfigs = this.displayConfigs;

    const index = displayConfigs.indexOf(item);
    const nextItem = displayConfigs[index + 1];
    const temp = item.displayOrder;
    item.displayOrder = nextItem.displayOrder;
    nextItem.displayOrder = temp;
  }

  public onOkButtonClick(): void {
    const result: Record<string, ISdSheetColumnConfigVM> = {};
    for (const config of this.configs) {
      result[config.key] = {
        widthPixel: config.widthPixel,
        displayOrder: config.displayOrder,
        fixed: config.fixed,
        group: config.group,
        header: config.header,
        hidden: config.hidden
      };
    }

    this.close(result);
  }

  public onCancelButtonClick(): void {
    this.close();
  }

  public onInitButtonClick(): void {
    if (confirm("설정값이 모두 초기화 됩니다.")) {
      this.close({});
    }
  }
}

export interface ISdSheetConfigModalInput {
  controls: SdSheetColumnControl[];
  configObj: Partial<Record<string, ISdSheetColumnConfigVM>> | undefined;
}

interface IColumnConfigVM {
  key: string;
  group?: string;
  header?: string;
  fixed: boolean;
  displayOrder: number;
  widthPixel?: number;
  hidden: boolean;
  resizable: boolean;
}
