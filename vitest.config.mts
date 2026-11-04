import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { exclude: ["**/node_modules/**", "supabase/load/**"] },
  resolve: {
    // Same alias as tsconfig "paths" so tests import modules the way the app does.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
