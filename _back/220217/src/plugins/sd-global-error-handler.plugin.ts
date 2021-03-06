import { ApplicationRef, ErrorHandler, Injectable, NgModuleRef } from "@angular/core";
import { SdSystemLogRootProvider } from "../root-providers/sd-system-log.root-provider";

@Injectable({ providedIn: null })
export class SdGlobalErrorHandlerPlugin implements ErrorHandler {
  public constructor(private readonly _ngModuleRef: NgModuleRef<any>,
                     private readonly _systemLog: SdSystemLogRootProvider) {
  }

  public handleError(error: any): void {
    const err: Error = error.rejection !== undefined ? error.rejection : error;

    const divEl = document.createElement("div");
    divEl.style.position = "fixed";
    divEl.style.top = "0";
    divEl.style.left = "0";
    divEl.style.width = "100%";
    divEl.style.height = "100%";
    divEl.style.color = "white";
    divEl.style.background = "rgba(0,0,0,.6)";
    divEl.style.zIndex = "9999";
    divEl.style.overflow = "auto";
    divEl.style.padding = "4px";

    divEl.innerHTML = `<pre style="font-size: 12px; font-family: monospace; line-height: 1.4em;">${err.stack ?? ""}</pre>`;

    try {
      const appRef = this._ngModuleRef.injector.get<ApplicationRef>(ApplicationRef);
      appRef["_views"][0]["rootNodes"][0].appendChild(divEl);
      divEl.onclick = () => {
        location.reload();
      };

      this._systemLog.writeAsync("error", err.stack).catch(() => {
      });
    }
    catch (err1) {
    }

    throw err;
  }
}
