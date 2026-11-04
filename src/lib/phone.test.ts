import { describe, expect, it } from "vitest";
import { isEgyptianMobile, normalizeEgyptianPhone } from "./phone";

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

describe("normalizeEgyptianPhone", () => {
  it.each([
    ["٠١٠٩٩٩٩٨٨٨٧", "01099998887"],
    ["۰۱۰۹۹۹۹۸۸۸۷", "01099998887"],
    ["+20 109 999 8887", "01099998887"],
    ["0020-109-999-8887", "01099998887"],
    ["010 9999 8887", "01099998887"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeEgyptianPhone(raw)).toBe(expected);
    expect(isEgyptianMobile(normalizeEgyptianPhone(raw))).toBe(true);
  });
  it("leaves invalid numbers invalid", () => {
    expect(isEgyptianMobile(normalizeEgyptianPhone("0221234567"))).toBe(false);
  });
});
