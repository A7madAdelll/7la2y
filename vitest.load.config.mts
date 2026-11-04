import { defineConfig } from "vitest/config";

// `npm run load:db`: database load test, not part of `npm test` (slow, measures capacity).
export default defineConfig({
  test: { include: ["supabase/load/**/*.test.ts"], testTimeout: 300_000, hookTimeout: 300_000 },
});
