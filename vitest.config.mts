import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same alias as tsconfig "paths" so tests import modules the way the app does.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
