import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SdCollapseModule } from "../collapse/sd-collapse.module";
import { SdCollapseIconModule } from "../collapse-icon/sd-collapse-icon.module";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { SdListControl } from "./sd-list.control";
import { SdListItemControl } from "./sd-list-item.control";

@NgModule({
  imports: [CommonModule, SdCollapseModule, SdCollapseIconModule, FontAwesomeModule],
  declarations: [SdListControl, SdListItemControl],
  exports: [SdListControl, SdListItemControl],
  providers: []
})
export class SdListModule {
}
