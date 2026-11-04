/**
 * Security headers for every response. CSP without nonces (Next.js guide "Without Nonces"):
 * nonce CSP would force every page to render dynamically and is incompatible with Partial
 * Prerendering, which the customer pages rely on for speed on cheap phones. This policy still
 * blocks scripts, frames and connections to any host except ours, Supabase and Cloudflare.
 */
export function securityHeaders(opts: { supabaseUrl?: string; dev: boolean }) {
  const supabase = opts.supabaseUrl ? new URL(opts.supabaseUrl).origin : "https://*.supabase.co";
  const supabaseWs = supabase.replace(/^https:/, "wss:");
  const turnstile = "https://challenges.cloudflare.com";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${turnstile}${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabaseWs} ${turnstile}`,
    `frame-src ${turnstile}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
