import { FsUtil } from "@simplysm/sd-core-node";
import * as path from "path";
import { expect } from "chai";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("(node) core.FsUtil", () => {
  it("특정 파일의 md5 값을 가져올 수 있다.", async () => {
    expect(
      await FsUtil.getMd5Async(path.resolve(__dirname, "FsUtilTestDir", "getMd5.txt"))
    ).to.equal("827ccb0eea8a706c4c34a16891f84e7b");
  });
  
  it("특정 폴더내의 파일 목록을 GLOB을 통해 가져올 수 있다.", async () => {
    expect(
      (
        await FsUtil.globAsync(path.resolve(__dirname, "FsUtilTestDir", "*"))
      ).map((item) => path.relative(path.resolve(__dirname, "FsUtilTestDir"), item))
    ).to.deep.equal([
      "getMd5.txt"
    ]);
  });
});
