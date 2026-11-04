import { describe, expect, it } from "vitest";
import { formatEGP, formatMinutes, formatPeople } from "./format";

describe("format", () => {
  it("formats EGP with Western digits", () => {
    expect(formatEGP(150)).toBe("150 ج.م");
    expect(formatEGP(1250.5)).toMatch(/^1[,٬]?250[.٫]5 ج\.م$/);
    expect(formatEGP(null)).toBe("السعر في المحل");
  });
  it.each([
    [0, "أقل من دقيقة"],
    [1, "دقيقة"],
    [2, "دقيقتين"],
    [7, "7 دقايق"],
    [35, "35 دقيقة"],
  ])("minutes %i -> %s", (n, s) => expect(formatMinutes(n)).toBe(s));
  it.each([
    [0, "مفيش حد"],
    [1, "شخص واحد"],
    [2, "شخصين"],
    [3, "3 أشخاص"],
    [12, "12 شخص"],
  ])("people %i -> %s", (n, s) => expect(formatPeople(n)).toBe(s));
});
