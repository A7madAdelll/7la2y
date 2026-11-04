import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths and rejects open redirects", () => {
    expect(safeNext("/counter/abc")).toBe("/counter/abc");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "counter"]) {
      expect(safeNext(bad)).toBe("/counter");
    }
  });
});
