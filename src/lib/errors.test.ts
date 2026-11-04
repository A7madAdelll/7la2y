import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, errorMessage } from "./errors";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "supabase", "migrations");

describe("error messages", () => {
  it("covers every error key the database can raise", () => {
    const sql = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
      .join("\n");
    const keys = new Set(
      [...sql.matchAll(/private\.fail\('([a-z_]+)'\)|message = '([a-z_]+)'/g)].map((m) => m[1] ?? m[2]),
    );
    keys.delete("p_key"); // the generic raise inside private.fail itself
    expect(keys.size).toBeGreaterThan(10);
    const missing = [...keys].filter((k) => !(k in ERROR_MESSAGES));
    expect(missing).toEqual([]);
  });

  it("maps keys and hides unknown errors", () => {
    expect(errorMessage({ message: "bad_code" })).toBe(ERROR_MESSAGES.bad_code);
    expect(errorMessage(new Error('relation "x" does not exist'))).not.toMatch(/relation/);
    expect(errorMessage(null)).toMatch(/مشكلة/);
  });
});

describe("error message text", () => {
  it("never ends with a number followed by punctuation (renders as '.015' in RTL)", () => {
    for (const msg of Object.values(ERROR_MESSAGES)) {
      expect(msg).not.toMatch(/\d[.!؟?]$/);
    }
  });
});
