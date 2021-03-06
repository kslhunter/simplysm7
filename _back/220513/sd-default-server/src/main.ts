import path from "path";
import { Logger, LoggerSeverity } from "@simplysm/sd-core-node";
import { SdAutoUpdateService, SdServiceServer } from "@simplysm/sd-service-server";

Error.stackTraceLimit = Infinity;

if (process.env["NODE_ENV"] === "production") {
  Logger.setConfig({
    console: {
      level: LoggerSeverity.none
    },
    file: {
      level: LoggerSeverity.debug,
      outDir: path.resolve(__dirname, "_logs")
    }
  });
}
else if (process.env["SD_CLI_LOGGER_SEVERITY"] === "DEBUG") {
  Logger.setConfig({
    console: {
      level: LoggerSeverity.debug
    }
  });
}
else {
  Logger.setConfig({
    console: {
      level: LoggerSeverity.log,
    },
    file: {
      level: LoggerSeverity.debug,
      outDir: path.resolve(process.cwd(), "_logs")
    }
  });
}

const server = new SdServiceServer({
  rootPath: __dirname,
  services: [
    SdAutoUpdateService
  ],
  port: 50080
});


const logger = Logger.get(["simplysm", "sd-default-server"]);

server.listenAsync().catch((err) => {
  logger.error(err);
  process.exit(1);
});

export = server;
