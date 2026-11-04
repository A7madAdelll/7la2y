import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  // CSP, HSTS and friends: see src/lib/security-headers.ts for the reasoning.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
