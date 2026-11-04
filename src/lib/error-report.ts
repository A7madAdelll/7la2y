// Minimal server-side Sentry reporter (envelope HTTP API), instead of the full @sentry/nextjs SDK:
// it keeps the customer pages' JS budget untouched and sends only what we choose.
// Privacy: no request headers (cookies, auth) and secret tokens in paths are masked.
import { randomUUID } from "node:crypto";

export type Dsn = { endpoint: string; publicKey: string };

/** https://<key>@<host>/<project> -> envelope endpoint + key. Null when missing or malformed. */
export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!u.username || !/^\d+$/.test(project)) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, publicKey: u.username };
  } catch {
    return null;
  }
}

/** Ticket, TV and invite links are bearer secrets: never send them anywhere. */
export function redactPath(path: string): string {
  return path
    .replace(/\/(t|tv|invite)\/[0-9a-f]{16,}/gi, "/$1/[token]")
    .replace(/([?&](code|token|access_token|refresh_token)=)[^&#]*/gi, "$1[redacted]");
}

export type ErrorContext = { method?: string; path?: string; routePath?: string; routeType?: string; where?: string };

export function buildEnvelope(err: unknown, ctx: ErrorContext, env: Record<string, string | undefined> = process.env): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  const eventId = randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: env.SENTRY_ENVIRONMENT || env.VERCEL_ENV || "development",
    release: env.VERCEL_GIT_COMMIT_SHA || undefined,
    exception: { values: [{ type: e.name, value: redactPath(e.message).slice(0, 1000) }] },
    tags: { route: ctx.routePath, route_type: ctx.routeType, where: ctx.where, digest },
    request: ctx.path ? { method: ctx.method, url: redactPath(ctx.path) } : undefined,
    extra: { stack: e.stack ? redactPath(e.stack).slice(0, 8000) : undefined },
  };
  const header = { event_id: eventId, sent_at: new Date().toISOString() };
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
}

/** Sends one error. Never throws and never takes longer than 2 s: reporting must not break a request. */
export async function reportError(err: unknown, ctx: ErrorContext = {}, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return false;
  try {
    const res = await fetchImpl(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=7la2y-lite/1.0`,
      },
      body: buildEnvelope(err, ctx),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
