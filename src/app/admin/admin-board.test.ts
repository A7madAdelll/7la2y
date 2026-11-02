import { describe, expect, it } from "vitest";
import { defaultPeriod } from "./admin-board";

describe("defaultPeriod", () => {
  it("covers one month from today", () => {
    expect(defaultPeriod("2026-11-03")).toEqual({ start: "2026-11-03", end: "2026-12-02" });
    expect(defaultPeriod("2026-12-15")).toEqual({ start: "2026-12-15", end: "2027-01-14" });
  });
});
