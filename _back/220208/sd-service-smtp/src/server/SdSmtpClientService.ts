import * as nodemailer from "nodemailer";
import { SdServiceBase, SdServiceServerConfigUtil } from "@simplysm/sd-service/server";
import { ISmtpClientSendByDefaultOption, ISmtpClientSendOption } from "../common";

export class SdSmtpClientService extends SdServiceBase {
  public async sendAsync(options: ISmtpClientSendOption): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const transport = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth: {
          user: options.user,
          pass: options.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      transport.sendMail(
        options,
        (err, info) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(info.messageId);
        }
      );
    });
  }

  public async sendByConfigAsync(configName: string, options: ISmtpClientSendByDefaultOption): Promise<string> {
    const config = (
      await SdServiceServerConfigUtil.getConfigAsync(this.server.options.rootPath, this.socket.request.url)
    )["smtp"]?.[configName];
    if (config === undefined) {
      throw new Error("서버에서 메일서버 설정을 찾을 수 없습니다.");
    }

    return await this.sendAsync({
      user: config.user,
      pass: config.pass,
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: `"${config.senderName as string}" <${(config.senderEmail ?? config.user) as string}>`,
      ...options
    });
  }
}
