import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "sdm-topbar-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content></ng-content>`,
  styles: [/* language=SCSS */ `
    @import "../../scss/mixins";

    :host {
      display: inline-block;
      line-height: var(--sd-topbar-height);
      min-width: var(--sd-topbar-height);
      padding: 0 var(--gap-default);
      text-align: center;
      color: var(--text-brightness-lighter);

      @include mobile-active-effect(true);
    }
  `]
})
export class SdmTopbarNavControl {
}
