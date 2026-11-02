import { describe, expect, it } from "vitest";
import { isEgyptianMobile } from "./phone";

describe("isEgyptianMobile", () => {
  it("accepts 01 + 9 digits", () => {
    expect(isEgyptianMobile("01012345678")).toBe(true);
  });
  it("rejects wrong length, prefix and non-digits", () => {
    expect(isEgyptianMobile("0101234567")).toBe(false);
    expect(isEgyptianMobile("02012345678")).toBe(false);
    expect(isEgyptianMobile("0101234567a")).toBe(false);
  });
});
