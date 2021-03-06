import { ChangeDetectionStrategy, Component, HostBinding, Input, NgZone } from "@angular/core";
import { SdInputValidate } from "../../decorators/SdInputValidate";

// @ts-ignore
import backgroundImage from "../../../assets/user_bg.jpg";

@Component({
  selector: "sd-sidebar-user",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="_content"
         [style]="'background: ' + 'url(' + backgroundImage + '); ' + contentStyle">
      <div class="sd-padding-lg">
        <ng-content></ng-content>
      </div>
      <div class="_menu-button" *ngIf="menuTitle" (click)="onMenuOpenButtonClick()">
        {{ menuTitle }}
        <sd-collapse-icon [open]="menuOpen" style="float: right;" openRotate="180"></sd-collapse-icon>
      </div>
    </div>
    <sd-collapse [open]="menuOpen" *ngIf="menuTitle">
      <ng-content select="sd-sidebar-user-menu"></ng-content>
    </sd-collapse>`,
  styles: [/* language=SCSS */ `
    :host {
      > ._content {
        background-size: cover;
        text-shadow: 0 0 1px var(--text-brightness-default);
        text-align: center;

        > ._menu-button {
          display: block;
          text-align: left;
          padding: var(--gap-sm) var(--gap-default);
          background: var(--trans-brightness-default);
          cursor: pointer;
          user-select: none;

          &:hover {
            background: var(--trans-brightness-dark);
          }

          &:active {
            background: var(--trans-brightness-darker);
          }
        }
      }

      &[sd-menu-open=true] {
        > ._content {
          > ._menu-button {
            background: var(--trans-brightness-dark);

            &:active {
              background: var(--trans-brightness-darker);
            }
          }
        }
      }
    }
  `]
})
export class SdSidebarUserControl {
  public backgroundImage = backgroundImage;

  @Input()
  @SdInputValidate(String)
  public menuTitle?: string;

  @HostBinding("attr.sd-menu-open")
  public menuOpen?: boolean;

  @Input("content.style")
  @SdInputValidate(String)
  public contentStyle?: string;

  public constructor(private readonly _zone: NgZone) {
  }

  public onMenuOpenButtonClick(): void {
    this.menuOpen = !this.menuOpen;
  }
}
