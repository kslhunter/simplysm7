import { SdServiceClient } from "../SdServiceClient";

export class SdAutoUpdateServiceClient {
  public constructor(private readonly _client: SdServiceClient) {
  }

  public async getLastVersionAsync(clientName: string, platform: string): Promise<string | undefined> {
    return await this._client.sendAsync("SdAutoUpdateService", "getLastVersionAsync", [clientName, platform]);
  }
}
