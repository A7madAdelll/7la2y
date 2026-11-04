import type { SendResult } from "./meta";

export type Claimed = {
  id: string;
  kind: "near_turn" | "confirm";
  phone: string;
  shop_name: string;
  ticket_no: number;
  payload: { token?: string } | null;
  services: string[];
};

export type OutboxDeps = {
  claim: (limit: number) => Promise<Claimed[]>;
  /** {{1}} shop name, {{2}} ticket (template queue_near_turn, see docs/setup.md) */
  sendTemplate: (to: string, params: string[]) => Promise<SendResult>;
  /** Free-form text, only for replies inside the customer's 24 h window ("confirm"). */
  sendText: (to: string, body: string) => Promise<SendResult>;
  complete: (id: string, r: SendResult) => Promise<void>;
  /** Public site origin for links, e.g. https://7la2y.com. Null = links cannot be built. */
  origin: string | null;
};

/** The reply to "confirm on WhatsApp": ticket, order and the queue link. */
export function confirmText(m: Pick<Claimed, "shop_name" | "ticket_no" | "services">, link: string): string {
  return [
    `تم تأكيد رقمك في ${m.shop_name}.`,
    `رقمك في الدور: ${m.ticket_no}`,
    m.services.length ? `طلبك: ${m.services.join(" + ")}` : null,
    `تابع دورك من هنا: ${link}`,
  ].filter(Boolean).join("\n");
}

/** One worker run: claim, send by kind, report. */
export async function runOutbox(deps: OutboxDeps, limit = 20) {
  const batch = await deps.claim(limit);
  const results = await Promise.all(
    batch.map(async (m) => {
      let r: SendResult;
      if (m.kind === "confirm") {
        r = deps.origin && m.payload?.token
          ? await deps.sendText(m.phone, confirmText(m, `${deps.origin}/t/${m.payload.token}`))
          : { ok: false, retry: false, error: deps.origin ? "missing_link" : "no_site_url" };
      } else {
        r = await deps.sendTemplate(m.phone, [m.shop_name, String(m.ticket_no)]);
      }
      await deps.complete(m.id, r);
      return r.ok;
    }),
  );
  return { claimed: batch.length, sent: results.filter(Boolean).length, failed: results.filter((ok) => !ok).length };
}

/** Where links in WhatsApp messages point: the fixed site URL, else Vercel's production domain. */
export function publicOrigin(env: Record<string, string | undefined> = process.env): string | null {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}
