"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** One browser client per tab (public anon key; RLS and function grants protect data). */
export function supabaseBrowser() {
  if (!client) {
    const env = publicEnv();
    client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}
