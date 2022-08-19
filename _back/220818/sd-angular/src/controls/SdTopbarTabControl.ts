import { ChangeDetectionStrategy, Component, EventEmitter, Output } from "@angular/core";
import { SdIconRootProvider } from "../root-providers/SdIconRootProvider";

@Component({
  selector: "sd-topbar-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content></ng-content>
    <a (click)="onCloseButtonClick($event)">
      <fa-icon [icon]="icon.get('xmark')" [fixedWidth]="true"></fa-icon>
    </a>`,
  styles: [/* language=SCSS */ `
    :host {
      display: inline-block;
      padding: 0 var(--gap-lg);
      cursor: pointer;
      line-height: calc(var(--sd-topbar-heigh) - var(--gap-sm) - 2px);
      vertical-align: bottom;
      border-top: 2px solid var(--theme-color-primary-darkest);
      border-left: 1px solid var(--theme-color-primary-darkest);
      border-right: 1px solid var(--theme-color-primary-darkest);
      margin-right: var(--gap-xs);
      background: var(--theme-color-primary-light);
      color: var(--text-brightness-default);

      > sd-anchor {
        color: var(--theme-color-primary-default);

        &:hover {
          color: var(--theme-color-primary-darker);
        }
      }

      &._selected {
        background: white;
        font-weight: bold;
      }
    }
  `]
})
export class SdTopbarTabControl {
  @Output("click.close")
  public readonly clickClose = new EventEmitter<MouseEvent>();

  public constructor(public readonly icon: SdIconRootProvider) {
  }

  public onCloseButtonClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.clickClose.emit(event);
  }
}