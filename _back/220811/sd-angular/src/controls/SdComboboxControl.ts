import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Input,
  IterableDiffer,
  IterableDiffers,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChild
} from "@angular/core";
import { SdComboboxItemControl } from "./SdComboboxItemControl";
import { NumberUtil } from "@simplysm/sd-core-common";
import { SdInputValidate } from "../decorators/SdInputValidate";

@Component({
  selector: "sd-combobox",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sd-textfield #textfield
                  [value]="text"
                  (valueChange)="onTextChange($event)"
                  [required]="required"
                  [disabled]="disabled">
    </sd-textfield>
    <div class="_icon" *ngIf="!disabled">
      <fa-icon [fixedWidth]="true" [icon]="icons.fasCaretDown | async"></fa-icon>
    </div>
    <div #dropdown class="_sd-combobox-dropdown" tabindex="0">
      <ng-content></ng-content>
    </div>`,
  styles: [/* language=SCSS */ `
    @import "../../scss/mixins";

    :host {
      display: block;
      overflow: visible;
      position: relative;

      > ._icon {
        position: absolute;
        top: 1px;
        right: 1px;
        padding: var(--gap-sm) 0;
        width: 30px;
        text-align: center;
        pointer-events: none;
      }

      > sd-textfield > input {
        padding-right: 30px !important;
      }
    }

    ._sd-combobox-dropdown {
      position: fixed;
      z-index: var(--z-index-dropdown);
      opacity: 0;
      transform: translateY(-10px);
      transition: .1s linear;
      transition-property: transform-opacity;
      pointer-events: none;
      background: white;
      @include elevation(6);
      min-width: 120px;

      &:focus {
        outline: 1px solid var(--theme-color-primary-default);
      }
    }
  `]
})
export class SdComboboxControl implements OnInit, OnDestroy, AfterContentChecked {
  public icons = {
    fasCaretDown: import("@fortawesome/pro-solid-svg-icons/faCaretDown").then(m => m.faCaretDown)
  };

  @Input()
  public value?: any;

  @Input()
  @SdInputValidate(Boolean)
  public required?: boolean;

  @Input()
  @SdInputValidate(Boolean)
  public disabled?: boolean;

  @Output()
  public readonly valueChange = new EventEmitter<any | undefined>();

  @Input()
  @SdInputValidate(String)
  public text?: string;

  @Output()
  public readonly textChange = new EventEmitter<string | undefined>();

  @Output()
  public readonly textChangeByInput = new EventEmitter<string | undefined>();

  @ContentChildren(SdComboboxItemControl, { descendants: true })
  public itemControls?: QueryList<SdComboboxItemControl>;

  @ViewChild("textfield", { static: true, read: ElementRef })
  public textfieldElRef?: ElementRef<HTMLElement>;

  @ViewChild("dropdown", { static: true })
  public dropdownElRef?: ElementRef<HTMLDivElement>;

  @Output()
  public readonly open = new EventEmitter();

  @Output()
  public readonly close = new EventEmitter();

  @Input()
  public userCustomText?: boolean;

  private readonly _iterableDiffer: IterableDiffer<SdComboboxItemControl>;

  public constructor(private readonly _iterableDiffers: IterableDiffers,
                     private readonly _elRef: ElementRef,
                     private readonly _cdr: ChangeDetectorRef) {
    this._iterableDiffer = this._iterableDiffers.find([]).create((i, itemControl) => itemControl.value);
  }

  public ngAfterContentChecked(): void {
    if (this.itemControls && this._iterableDiffer.diff(this.itemControls.toArray())) {
      this._refreshText();
      this._cdr.markForCheck();
    }
  }

  public ngOnInit(): void {
    const textfieldEl = this.textfieldElRef!.nativeElement;
    const dropdownEl = this.dropdownElRef!.nativeElement;

    textfieldEl.addEventListener("focus", this.focusEventHandler, true);
    textfieldEl.addEventListener("blur", this.blurEventHandler, true);
    dropdownEl.addEventListener("blur", this.blurEventHandler, true);

    if (this.userCustomText) {
      const newText = this.value != null ? this.value.toString() : this.value;
      if (this.textChange.observed) {
        this.textChange.emit(newText);
      }
      else {
        this.text = newText;
      }
    }
  }

  public ngOnDestroy(): void {
    this.dropdownElRef!.nativeElement.remove();
  }

  public onTextChange(text: string): void {
    if (this.textChange.observed) {
      this.textChange.emit(text);
    }
    else {
      this.text = text;
    }
    this.textChangeByInput.emit(text);

    if (this.value !== undefined) {
      if (this.userCustomText) {
        const newValue = NumberUtil.parseInt(text);
        if (this.valueChange.observed) {
          this.valueChange.emit(newValue);
        }
        else {
          this.value = newValue;
        }
      }
      else {
        const newValue = undefined;
        if (this.valueChange.observed) {
          this.valueChange.emit(newValue);
        }
        else {
          this.value = newValue;
        }
      }
    }
    else {
      if (this.userCustomText) {
        const newValue = NumberUtil.parseInt(text);
        if (this.valueChange.observed) {
          this.valueChange.emit(newValue);
        }
        else {
          this.value = newValue;
        }
      }
    }
  }

  public setValueFromItemControl(value: any, itemControl: SdComboboxItemControl): void {
    if (this.value !== value) {
      if (this.valueChange.observed) {
        this.valueChange.emit(value);
      }
      else {
        this.value = value;
      }
      this.closePopup();
    }

    if (this.text !== itemControl.content) {
      const newText = itemControl.content;
      if (this.textChange.observed) {
        this.textChange.emit(newText);
      }
      else {
        this.text = newText;
      }
    }
  }

  public openPopup(): void {
    const textfieldEl = this.textfieldElRef!.nativeElement;
    const dropdownEl = this.dropdownElRef!.nativeElement;
    document.body.appendChild(dropdownEl);

    if (window.innerHeight < textfieldEl.getRelativeOffset(window.document.body).top * 2) {
      Object.assign(
        dropdownEl.style,
        {
          top: "",
          bottom: (window.innerHeight - textfieldEl.getRelativeOffset(window.document.body).top) + "px",
          left: textfieldEl.getRelativeOffset(window.document.body).left + "px",
          opacity: "1",
          pointerEvents: "auto",
          transform: "none"
        }
      );
    }
    else {
      Object.assign(
        dropdownEl.style,
        {
          top: (textfieldEl.getRelativeOffset(window.document.body).top + textfieldEl.offsetHeight) + "px",
          bottom: "",
          left: textfieldEl.getRelativeOffset(window.document.body).left + "px",
          opacity: "1",
          pointerEvents: "auto",
          transform: "none"
        }
      );
    }

    document.addEventListener("scroll", this.scrollEventHandler, true);
    this.open.emit();
  }

  public closePopup(): void {
    const dropdownEl = this.dropdownElRef!.nativeElement;
    try {
      // dropdownEl.remove();
    }
    catch (err) {
      if (err instanceof Error) {
        if (!err.message.includes("no longer a child of this node")) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }

    Object.assign(
      dropdownEl.style,
      {
        opacity: "0",
        pointerEvents: "none",
        transform: "translateY(-10px)"
      }
    );

    if (this.value == null && this.text != null) {
      const newText = this.userCustomText ? this.text : undefined;
      if (this.textChange.observed) {
        this.textChange.emit(newText);
      }
      else {
        this.text = newText;
      }
      return;
    }

    this._refreshText();
    this.close.emit();
  }

  public scrollEventHandler = (event: Event): void => {
    const textfieldEl = this.textfieldElRef!.nativeElement;
    const dropdownEl = this.dropdownElRef!.nativeElement;

    if ((this._elRef.nativeElement as HTMLElement).findParent(event.target as HTMLElement)) {
      if (window.innerHeight < textfieldEl.getRelativeOffset(window.document.body).top * 2) {
        Object.assign(
          dropdownEl.style,
          {
            top: "",
            bottom: (window.innerHeight - textfieldEl.getRelativeOffset(window.document.body).top) + "px",
            left: textfieldEl.getRelativeOffset(window.document.body).left + "px"
          }
        );
      }
      else {
        Object.assign(
          dropdownEl.style,
          {
            top: (textfieldEl.getRelativeOffset(window.document.body).top + textfieldEl.offsetHeight) + "px",
            bottom: "",
            left: textfieldEl.getRelativeOffset(window.document.body).left + "px"
          }
        );
      }
    }
  };

  public focusEventHandler = (event: FocusEvent): void => {
    this.openPopup();
  };

  public blurEventHandler = (event: FocusEvent): void => {
    document.removeEventListener("scroll", this.scrollEventHandler, true);

    const textfieldEl = this.textfieldElRef!.nativeElement;
    const dropdownEl = this.dropdownElRef!.nativeElement;

    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (
      relatedTarget != null
      && (
        relatedTarget === textfieldEl
        || relatedTarget === dropdownEl
        || relatedTarget.findParent(textfieldEl)
        || relatedTarget.findParent(dropdownEl)
      )
    ) {
      return;
    }

    this.closePopup();
  };

  private _refreshText(): void {
    if (this.value != null) {
      if (!this.userCustomText) {
        const selectedItemControl = this.itemControls!.find((item) => item.value === this.value);

        if (selectedItemControl) {
          const text = selectedItemControl.content;
          if (text !== this.text) {
            if (this.textChange.observed) {
              this.textChange.emit(text);
            }
            else {
              this.text = text;
            }
          }
        }
      }
    }
  }
}
