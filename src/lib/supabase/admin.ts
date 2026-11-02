import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Service-role client: bypasses RLS. Use ONLY for functions granted to service_role
 * (join_queue) from server code, after validating input and the bot check.
 */
export function supabaseAdmin() {
  return createClient(publicEnv().supabaseUrl, serverEnv().supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
