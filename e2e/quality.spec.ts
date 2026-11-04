import { expect, test } from "@playwright/test";

const PAGES = ["/demo", "/demo/join", "/demo/status", "/demo/counter", "/demo/admin", "/ui-kit", "/login", "/onboarding", "/privacy"];

test.describe("quality bar on every page", () => {
  for (const path of PAGES) {
    test(`${path}: RTL, Arabic font, no sideways scroll, touch targets, no CSP violations`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && problems.push(m.text()));
      page.on("pageerror", (e) => problems.push(e.message));
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        font: [...document.fonts].some((f) => /Plex/i.test(f.family) && f.status === "loaded"),
        small: [...document.querySelectorAll("button, a, input:not([type=checkbox]), select")]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.height > 0 && b.height < 44 && !e.closest("footer, p"); })
          .map((e) => (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 30)),
      }));
      expect(r.dir).toBe("rtl");
      expect(r.lang).toBe("ar");
      expect(r.overflow).toBe(0);
      expect(r.font).toBe(true);
      expect(r.small).toEqual([]);
      expect(problems).toEqual([]);
    });
  }

  test("security headers are sent", async ({ request }) => {
    const res = await request.get("/demo/join");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("the QR poster prints on exactly one A5 page", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "PDF printing is Chromium-only");
    await page.goto("/demo/poster");
    await page.evaluate(() => document.fonts.ready);
    const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
    expect(pdf).toMatch(/\/MediaBox \[0 0 420 59[45]/);
  });

  test("the app can be installed (manifest + icons)", async ({ request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m).toMatchObject({ lang: "ar", dir: "rtl", display: "standalone" });
    for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
  });
});
