import { describe, expect, it } from "vitest";
import { hasBearer } from "./bearer";

describe("hasBearer", () => {
  it("matches only the exact secret, and never when no secret is configured", () => {
    expect(hasBearer("Bearer s3cret", "s3cret")).toBe(true);
    expect(hasBearer("Bearer s3cre", "s3cret")).toBe(false);
    expect(hasBearer("s3cret", "s3cret")).toBe(false);
    expect(hasBearer(null, "s3cret")).toBe(false);
    expect(hasBearer("Bearer ", undefined)).toBe(false);
  });
});
