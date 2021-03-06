import { PropertyValidate } from "@simplysm/sd-core-common";
import { expect } from "chai";

describe("(common) core.decorators.PropertyValidate", () => {
  it("속성의 유효성을 확인할 수 있다.", () => {
    //-- 준비
    
    class TestClass {
      @PropertyValidate({
        type: String,
        includes: ["1", "2"],
        notnull: true,
        validator: (item) => item !== undefined
      })
      public testProp?: any;
    }

    //-- 테스트

    try {
      const testObject = new TestClass();
      testObject.testProp = undefined;
    }
    catch (err) {
      expect(err.message)
        .to.includes(`"type"`).and
        .to.includes(`"includes"`).and
        .to.includes(`"notnull"`).and
        .to.includes(`"validator"`);
      return;
    }

    expect.fail("에러가 발생했어야 합니다.");
  });
});
