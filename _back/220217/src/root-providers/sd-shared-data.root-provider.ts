import { Injectable } from "@angular/core";
import { NeverEntryError, ObjectUtil, Wait } from "@simplysm/sd-core-common";
import { SdServiceFactoryRootProvider } from "./sd-service-factory.root-provider";
import { SdServiceEventBase } from "@simplysm/sd-service-common";

@Injectable({ providedIn: "root" })
export class SdSharedDataRootProvider {
  private readonly _dataInfoMap = new Map<string, ISharedDataInfo<any, any>>();
  private readonly _dataChangeListenerMap = new Map<string, (() => void)[]>();
  private readonly _dataMap = new Map<string, any[]>();
  private readonly _dataMapMap = new Map<string, Map<number | string, any>>();
  private readonly _isProcessingMap = new Map<string, boolean>();

  public constructor(private readonly _serviceFactory: SdServiceFactoryRootProvider) {
  }

  public async clearAsync(): Promise<void> {
    for (const isProcessingMapKey of Array.from(this._isProcessingMap.keys())) {
      if (this._isProcessingMap.get(isProcessingMapKey)) {
        await Wait.until(() => !this._isProcessingMap.get(isProcessingMapKey));
      }
    }

    this._dataInfoMap.clear();
    this._dataChangeListenerMap.clear();
    this._dataMap.clear();
    this._dataMapMap.clear();
    this._isProcessingMap.clear();
  }

  public register<V extends string | number, T extends ISharedDataBase<V>>(dataType: string, info: ISharedDataInfo<V, T>): void {
    if (this._dataInfoMap.has(dataType)) {
      throw new NeverEntryError();
    }
    this._dataInfoMap.set(dataType, info);
  }

  public async getDataAsync(serviceKey: string, dataType: string): Promise<any[] | undefined> {
    await this._loadDataAsync(serviceKey, dataType);
    return this._dataMap.get(dataType);
  }

  public async getDataMapAsync(serviceKey: string, dataType: string): Promise<Map<number | string, any> | undefined> {
    await this._loadDataAsync(serviceKey, dataType);
    return this._dataMapMap.get(dataType);
  }

  public on(dataType: string, callback: () => void): void {
    if (this._dataChangeListenerMap.has(dataType)) {
      this._dataChangeListenerMap.get(dataType)!.push(callback);
    }
    else {
      this._dataChangeListenerMap.set(dataType, [callback]);
    }
  }

  public off(dataType: string, callback: () => void): void {
    const list = this._dataChangeListenerMap.get(dataType);
    if (!list) return;

    list.remove((item: Function) => item === callback);
  }

  public async emitAsync(serviceKey: string, dataType: string, changeKeys?: (string | number)[]): Promise<void> {
    await this._serviceFactory.get(serviceKey).emitAsync(
      SdSharedDataChangeEvent,
      (item) => item === dataType,
      changeKeys
    );
  }

  private async _loadDataAsync(serviceKey: string, dataType: string): Promise<void> {
    if (this._isProcessingMap.get(dataType)) {
      await Wait.until(() => !this._isProcessingMap.get(dataType));
    }
    this._isProcessingMap.set(dataType, true);

    if (!this._dataMap.has(dataType)) {
      const info = this._dataInfoMap.get(dataType);
      if (!info) throw new Error(`'${dataType}'??? ?????? 'SdSharedData' ?????? ????????? ????????????.`);

      let data = await info.getData();
      for (const orderBy of info.orderBy.reverse()) {
        data = orderBy[1] === "desc" ? data.orderByDesc((item) => orderBy[0](item))
          : data.orderBy((item) => orderBy[0](item));
      }
      this._dataMap.set(dataType, data);
      this._dataMapMap.set(dataType, data.toMap((item) => info.getKey(item)));

      await this._serviceFactory.get(serviceKey).addEventListenerAsync(
        SdSharedDataChangeEvent,
        dataType,
        async (changeKeys) => {
          const currItems = this._dataMap.get(dataType);
          if (!currItems) return;

          const currMapData = this._dataMapMap.get(dataType);
          if (!currMapData) return;

          if (changeKeys) {
            const dbItems = await info.getData(changeKeys);

            // ????????? ?????? ?????? (DB??? ?????? ??????)
            const deleteKeys = changeKeys.filter((changeKey) => !dbItems.some((dbItem) => info.getKey(dbItem) === changeKey));
            currItems.remove((item) => deleteKeys.includes(info.getKey(item)));
            for (const deleteKey of deleteKeys) {
              currMapData.delete(deleteKey);
            }

            // ????????? ?????? ??????
            for (const dbItem of dbItems) {
              const dbItemKey = info.getKey(dbItem);

              const currItem = currItems.single((item) => info.getKey(item) === dbItemKey);
              if (currItem !== undefined) {
                ObjectUtil.clear(currItem);
                Object.assign(currItem, dbItem);
              }
              else {
                currItems.push(dbItem);
              }

              if (currMapData.has(dbItemKey)) {
                const currMapItem = currMapData.get(dbItemKey);
                ObjectUtil.clear(currMapItem);
                Object.assign(currMapItem, dbItem);
              }
              else {
                currMapData.set(dbItemKey, dbItem);
              }
            }
          }
          // ???????????? ????????????
          else {
            const dbItems = await info.getData();

            currItems.clear();
            currMapData.clear();
            for (const newItem of dbItems) {
              currItems.push(newItem);
              const newKey = info.getKey(newItem);
              currMapData.set(newKey, newItem);
            }
          }

          let tempCurrItems = [...currItems];
          currItems.clear();

          for (const orderBy of info.orderBy.reverse()) {
            tempCurrItems = orderBy[1] === "desc" ? tempCurrItems.orderByDesc((item) => orderBy[0](item))
              : tempCurrItems.orderBy((item) => orderBy[0](item));
          }
          currItems.push(...tempCurrItems);

          const listeners = this._dataChangeListenerMap.get(dataType);
          if (listeners && listeners.length > 0) {
            for (const listener of listeners) {
              listener();
            }
          }
        }
      );
    }

    this._isProcessingMap.set(dataType, false);
  }
}

export interface ISharedDataInfo<V extends string | number, T extends ISharedDataBase<V>> {
  getData: (changeKeys?: V[]) => T[] | Promise<T[]>;
  getKey: (data: T) => V;
  orderBy: [(data: T) => any, "asc" | "desc"][];
}

export interface ISharedDataBase<V extends string | number> {
  __valueKey: V;
  __searchText: string;
  __isHidden: boolean;
}

export class SdSharedDataChangeEvent extends SdServiceEventBase<string, (string | number)[] | undefined> {
}
