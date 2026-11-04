// JS budget for customer pages (build-plan quality bar: < 150 KB on a cheap Android over 3G).
// Reads the prerendered HTML shells after `next build`, collects every JS chunk they reference
// (including chunks for streamed client components) and totals their Brotli size, which is how
// Vercel serves them. Chunks loaded later with import() (the live-update client) are not counted:
// the budget is for the page being usable. Fails CI when a customer route goes over budget.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const BUDGET_KB = 150;
const ROUTES = ["[shop]", "t/[token]"]; // what customers open: the QR page and their ticket

let failed = false;
for (const route of ROUTES) {
  const html = readFileSync(join(".next/server/app", `${route}.html`), "utf8");
  // Legacy polyfills are tagged noModule: modern phone browsers never download them.
  const legacy = new Set([...html.matchAll(/<script[^>]*src="[^"]*static\/chunks\/([\w.-]+\.js)"[^>]*noModule/gi)].map((m) => m[1]));
  const chunks = new Set([...html.matchAll(/static\/chunks\/([\w.-]+\.js)/g)].map((m) => m[1]).filter((c) => !legacy.has(c)));
  let bytes = 0;
  for (const c of chunks) {
    const buf = readFileSync(join(".next/static/chunks", c));
    bytes += brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  }
  const kb = Math.round(bytes / 1024);
  const ok = kb <= BUDGET_KB;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} /${route}: ${kb} KB JS (brotli, ${chunks.size} files), budget ${BUDGET_KB} KB`);
}
process.exit(failed ? 1 : 0);
