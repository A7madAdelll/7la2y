import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

/** 01xxxxxxxxx -> 201xxxxxxxxx (Meta wants international format without "+"). */
export function toInternational(phone: string): string {
  if (!/^01[0125]\d{8}$/.test(phone)) throw new Error("invalid_phone");
  return "2" + phone;
}

export type SendResult = { ok: true; id: string } | { ok: false; retry: boolean; error: string };

/** Sends one approved template message. Retries only make sense for 429 / 5xx / network errors. */
export async function sendTemplate(
  cfg: { token: string; phoneNumberId: string; template: string; language: string },
  to: string,
  params: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetchImpl(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toInternational(to),
        type: "template",
        template: {
          name: cfg.template,
          language: { code: cfg.language },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (res.ok && data.messages?.[0]?.id) return { ok: true, id: data.messages[0].id };
    const retry = res.status === 429 || res.status >= 500;
    return { ok: false, retry, error: `${res.status} ${data.error?.code ?? ""} ${data.error?.message ?? ""}`.trim() };
  } catch (e) {
    if (e instanceof Error && e.message === "invalid_phone") return { ok: false, retry: false, error: "invalid_phone" };
    return { ok: false, retry: true, error: e instanceof Error ? e.name : "network" };
  }
}

/**
 * Free-form text reply. Only allowed inside the 24 h window the customer opened by messaging us
 * (the "confirm on WhatsApp" flow), so no template is needed.
 */
export async function sendText(
  cfg: { token: string; phoneNumberId: string },
  to: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetchImpl(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toInternational(to), type: "text", text: { body, preview_url: true } }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (res.ok && data.messages?.[0]?.id) return { ok: true, id: data.messages[0].id };
    return { ok: false, retry: res.status === 429 || res.status >= 500, error: `${res.status} ${data.error?.code ?? ""} ${data.error?.message ?? ""}`.trim() };
  } catch (e) {
    if (e instanceof Error && e.message === "invalid_phone") return { ok: false, retry: false, error: "invalid_phone" };
    return { ok: false, retry: true, error: e instanceof Error ? e.name : "network" };
  }
}

/** Incoming customer text messages from a webhook payload (sender in international format). */
export function parseInbound(body: unknown): { from: string; text: string }[] {
  const out: { from: string; text: string }[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] })?.changes ?? []) {
      const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [];
      for (const m of messages as { from?: unknown; type?: unknown; text?: { body?: unknown } }[]) {
        if (typeof m.from === "string" && /^\d{8,15}$/.test(m.from) && m.type === "text" && typeof m.text?.body === "string") {
          out.push({ from: m.from, text: m.text.body.slice(0, 500) });
        }
      }
    }
  }
  return out;
}

/** Meta signs webhook bodies: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"), "hex");
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type StatusUpdate = { id: string; status: "delivered" | "read" | "failed"; error?: string };

/** Pulls message status updates out of a webhook payload; ignores everything else. */
export function parseStatuses(body: unknown): StatusUpdate[] {
  const out: StatusUpdate[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] })?.changes ?? []) {
      const statuses = (change as { value?: { statuses?: unknown[] } })?.value?.statuses ?? [];
      for (const s of statuses as { id?: unknown; status?: unknown; errors?: { title?: string }[] }[]) {
        if (typeof s.id === "string" && (s.status === "delivered" || s.status === "read" || s.status === "failed")) {
          out.push({ id: s.id, status: s.status, error: s.errors?.[0]?.title });
        }
      }
    }
  }
  return out;
}
