import { defineConfig, devices } from "@playwright/test";

// End-to-end tests on the production build (`npm run build` first). The /demo screens run the real
// components on sample data, so these run without Supabase. Flows against a live Supabase project
// go in e2e/live/ and run only when E2E_BASE_URL is set (staging).
export default defineConfig({
  testDir: "e2e",
  testIgnore: process.env.E2E_BASE_URL ? [] : ["live/**"],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    locale: "ar-EG",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 760 } } },
    { name: "tablet", use: { viewport: { width: 1180, height: 820 } }, testMatch: /counter|tv/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next start -p 3200", url: "http://localhost:3200/demo", reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
