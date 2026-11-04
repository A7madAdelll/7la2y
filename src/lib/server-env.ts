import "server-only";

// Server-only secrets. The "server-only" import makes the build fail if this file is ever
// imported from a Client Component, so these values cannot reach the browser bundle.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const serverEnv = () => ({
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  turnstileSecretKey: required("TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY),
});
