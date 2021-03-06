import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  NgZone,
  Output,
  ViewChild
} from "@angular/core";
import { SdInputValidate } from "../../decorators/SdInputValidate";
import { faEye as fasEye } from "@fortawesome/pro-solid-svg-icons/faEye";
import { faPen as fasPen } from "@fortawesome/pro-solid-svg-icons/faPen";
import { faCode as fasCode } from "@fortawesome/pro-solid-svg-icons/faCode";
import { faPlus as fasPlus } from "@fortawesome/pro-solid-svg-icons/faPlus";
import { faMinus as fasMinus } from "@fortawesome/pro-solid-svg-icons/faMinus";

@Component({
  selector: "sd-html-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-dock-container>
      <sd-dock class="_toolbar" *ngIf="!disabled">
        <sd-anchor (click)="viewState = 'preview'" [class._selected]="viewState === 'preview'">
          <fa-icon [icon]="icons.fasEye" [fixedWidth]="true"></fa-icon>
        </sd-anchor>
        <sd-anchor (click)="viewState = 'edit'" [class._selected]="viewState === 'edit'">
          <fa-icon [icon]="icons.fasPen" [fixedWidth]="true"></fa-icon>
        </sd-anchor>
        <sd-anchor (click)="viewState = 'code'" [class._selected]="viewState === 'code'">
          <fa-icon [icon]="icons.fasCode" [fixedWidth]="true"></fa-icon>
        </sd-anchor>
        <ng-container *ngIf="rowsButton && !inset && viewState === 'code'">
          |
          <sd-anchor (click)="rows = rows + 1">
            <fa-icon [icon]="icons.fasPlus" [fixedWidth]="true"></fa-icon>
          </sd-anchor>
          <sd-anchor (click)="rows = rows - 1" *ngIf="rows > 1">
            <fa-icon [icon]="icons.fasMinus" [fixedWidth]="true"></fa-icon>
          </sd-anchor>
        </ng-container>
      </sd-dock>

      <sd-pane>
        <div #editor *ngIf="viewState !== 'code' || disabled"
             [attr.contenteditable]="viewState === 'edit' && !disabled"
             [style.min-height.px]="contentMinHeightPx"
             (input)="onContentInput($event)"></div>
        <textarea *ngIf="viewState === 'code' && !disabled"
                  [value]="value || ''"
                  [rows]="inset ? undefined : rows"
                  [style.resize]="inset ? 'none' : resize"
                  (input)="onTextareaInput($event)"
                  wrap="off"></textarea>
      </sd-pane>
    </sd-dock-container>`,
  styles: [/* language=SCSS */ `
    @import "../../../scss/mixins";

    :host {
      display: block;
      border: 1px solid var(--trans-brightness-default);

      ::ng-deep > sd-dock-container {
        > ._toolbar {
          > div {
            user-select: none;

            > sd-anchor {
              display: inline-block;
              padding: var(--gap-sm) 0;
              text-align: center;
              width: calc(var(--gap-sm) * 2 + var(--font-size-default) * var(--line-height-strip-unit));

              &:hover {
                background: rgba(0, 0, 0, .05);
              }

              &._selected {
                background: var(--theme-color-primary-default);
                color: var(--text-brightness-rev-default);
              }
            }
          }
        }

        > sd-pane {
          > div {
            @include form-control-base();
            height: 100%;
            overflow: auto;

            &[contenteditable=true] {
              cursor: text;
              background: var(--theme-color-secondary-lightest);
            }
          }

          > textarea {
            @include form-control-base();
            height: 100%;
            background: var(--theme-color-info-lightest);
            border: none;
            transition: outline-color .1s linear;
            outline: 1px solid transparent;
            outline-offset: -1px;

            &::-webkit-input-placeholder {
              color: var(--text-brightness-lighter);
            }

            &:focus {
              outline-color: var(--theme-color-primary-default);
            }
          }
        }
      }

      &[sd-inset=true] {
        height: 100%;
        border: none;
      }
    }
  `]
})
export class SdHtmlEditorControl {
  public icons = {
    fasEye,
    fasPen,
    fasCode,
    fasPlus,
    fasMinus
  };

  @Input()
  @SdInputValidate(String)
  public get value(): string | undefined {
    return this._value;
  }

  public set value(value: string | undefined) {
    if (this._value !== value) {
      this._value = value;
      this.reloadEditor();
    }
  }

  private _value?: string;

  @Output()
  public readonly valueChange = new EventEmitter<string>();

  @Input()
  @SdInputValidate({ type: String, includes: ["preview", "edit", "code"] })
  @HostBinding("attr.sd-view-state")
  public get viewState(): "preview" | "edit" | "code" {
    return this._viewState;
  }

  public set viewState(value: "preview" | "edit" | "code") {
    if (this._viewState !== value) {
      this._viewState = value;
      this.reloadEditor();
    }
  }

  private _viewState: "preview" | "edit" | "code" = "edit";

  @Input()
  @SdInputValidate({ type: Boolean, notnull: true })
  public rowsButton = true;

  @Input()
  @SdInputValidate({ type: Number, notnull: true })
  public rows = 3;

  @Input()
  @SdInputValidate(Boolean)
  @HostBinding("attr.sd-inset")
  public inset?: boolean;

  @Input()
  @SdInputValidate(Boolean)
  @HostBinding("attr.sd-disabled")
  public disabled?: boolean;

  @Input("content.min-height.px")
  @SdInputValidate({ type: Number, notnull: true })
  public contentMinHeightPx = 100;

  @Input()
  @SdInputValidate({
    type: String,
    notnull: true,
    includes: ["both", "horizontal", "vertical", "none"]
  })
  public resize = "vertical";

  @ViewChild("editor")
  public editorElRef?: ElementRef;

  public constructor(private readonly _zone: NgZone) {
  }

  public onTextareaInput(event: Event): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const newValue = textareaEl.value;
    if (this.valueChange.observers.length > 0) {
      this.valueChange.emit(newValue);
    }
    else {
      this._value = newValue;
    }
  }

  public onContentInput(event: Event): void {
    const editorEl = event.target as HTMLDivElement;
    const newValue = editorEl.innerHTML;
    if (this.valueChange.observers.length > 0) {
      this.valueChange.emit(newValue);
    }
    else {
      this._value = newValue;
    }
  }

  public reloadEditor(): void {
    setTimeout(() => {
      this._zone.run(() => {
        const editorEl = this.editorElRef?.nativeElement as HTMLDivElement | undefined;
        if (editorEl !== undefined && editorEl.innerHTML !== (this._value ?? "")) {
          editorEl.innerHTML = this._value ?? "";
        }
      });
    });
  }
}
