import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

describe("clientIpFrom", () => {
  it("prefers x-real-ip, then the first x-forwarded-for hop, else 'unknown'", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
