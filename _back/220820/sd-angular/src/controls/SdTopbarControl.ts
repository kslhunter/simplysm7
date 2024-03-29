import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  forwardRef,
  HostBinding,
  Inject,
  Injector,
  Input
} from "@angular/core";
import { SdTopbarContainerControl } from "./SdTopbarContainerControl";
import { SdSidebarContainerControl } from "./SdSidebarContainerControl";

@Component({
  selector: "sd-topbar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="_sidebar-toggle-button" (click)="onSidebarToggleButtonClick()"
       *ngIf="sidebarContainerControl || sidebarContainer">
      <fa-icon [icon]="icons.fasBars | async" [fixedWidth]="true"></fa-icon>
    </a>
    <sd-gap direction="width" size="default" *ngIf="!sidebarContainerControl && !sidebarContainer"></sd-gap>
    <ng-content></ng-content>`,
  styles: [/* language=SCSS */ `
    @import "../../scss/scss_settings";

    :host {
      display: block;
      position: absolute;
      z-index: var(--z-index-topbar);
      top: 0;
      left: 0;
      width: 100%;
      height: var(--sd-topbar-height);
      background: var(--theme-color-primary-default);
      color: var(--text-brightness-rev-default);
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
      line-height: var(--sd-topbar-height);
      user-select: none;

      @each $h in (h1, h2, h3, h4, h5, h6) {
        > ::ng-deep #{$h} {
          display: inline-block;
          vertical-align: top;
          line-height: var(--sd-topbar-height);
          margin-right: var(--gap-xxl);
        }
      }

      &::-webkit-scrollbar-track {
        background-color: rgba(0, 0, 0, .1);
      }

      &::-webkit-scrollbar-corner {
        background-color: rgba(0, 0, 0, .1);
      }

      &::-webkit-scrollbar {
        width: var(--gap-sm);
        height: var(--gap-sm);
        background-color: rgba(0, 0, 0, 0);
      }

      &::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, .2);
      }

      > ._sidebar-toggle-button {
        display: inline-block;
        vertical-align: top;
        min-width: var(--sd-topbar-height);
        text-align: center;
        margin-right: var(--gap-default);
        color: var(--text-brightness-rev-dark);
        cursor: pointer;
        font-size: 16px;

        &:hover {
          background: rgba(0, 0, 0, .2);
          color: var(--text-brightness-rev-default);
        }
      }

      &[sd-size="sm"] {
        height: var(--sd-topbar-height-sm);
        line-height: var(--sd-topbar-height-sm);
        @each $h in (h1, h2, h3, h4, h5, h6) {
          > ::ng-deep #{$h} {
            line-height: var(--sd-topbar-height-sm);
          }
        }

        > ._sidebar-toggle-button {
          min-width: var(--sd-topbar-height-sm);
        }
      }

      &[sd-size="lg"] {
        height: var(--sd-topbar-height-lg);
        line-height: var(--sd-topbar-height-lg);
        @each $h in (h1, h2, h3, h4, h5, h6) {
          > ::ng-deep #{$h} {
            line-height: var(--sd-topbar-height-lg);
          }
        }

        > ._sidebar-toggle-button {
          min-width: var(--sd-topbar-height-lg);
        }
      }
    }
  `]
})
export class SdTopbarControl implements DoCheck {
  public icons = {
    fasBars: import("@fortawesome/pro-solid-svg-icons/faBars").then(m => m.definition)
  };

  @HostBinding("attr.sd-size")
  public get size(): "sm" | "lg" | undefined {
    return this._topbarContainerControl.size;
  }

  @Input()
  public sidebarContainer?: SdSidebarContainerControl;

  public readonly sidebarContainerControl?: SdSidebarContainerControl;

  public constructor(@Inject(forwardRef(() => SdTopbarContainerControl))
                     private readonly _topbarContainerControl: SdTopbarContainerControl,
                     private readonly _injector: Injector,
                     private readonly _elRef: ElementRef) {
    this.sidebarContainerControl = this._injector.get(SdSidebarContainerControl, null) ?? undefined;
  }

  public onSidebarToggleButtonClick(): void {
    const sidebarContainerControl = this.sidebarContainer ?? this.sidebarContainerControl;
    sidebarContainerControl!.toggle = !sidebarContainerControl!.toggle;
  }

  public ngDoCheck(): void {
    this._topbarContainerControl.paddingTopPx = this._elRef.nativeElement.offsetHeight;
  }
}
