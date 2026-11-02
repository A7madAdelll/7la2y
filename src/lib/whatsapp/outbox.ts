import type { SendResult } from "./meta";

export type Claimed = { id: string; phone: string; shop_name: string; ticket_no: number };

export type OutboxDeps = {
  claim: (limit: number) => Promise<Claimed[]>;
  send: (to: string, params: string[]) => Promise<SendResult>;
  complete: (id: string, r: SendResult) => Promise<void>;
};

/**
 * One worker run: claim, send, report. Template parameters: {{1}} shop name, {{2}} ticket number
 * (see docs/setup.md for the template text). Sends run in small parallel batches.
 */
export async function runOutbox(deps: OutboxDeps, limit = 20) {
  const batch = await deps.claim(limit);
  const results = await Promise.all(
    batch.map(async (m) => {
      const r = await deps.send(m.phone, [m.shop_name, String(m.ticket_no)]);
      await deps.complete(m.id, r);
      return r.ok;
    }),
  );
  return { claimed: batch.length, sent: results.filter(Boolean).length, failed: results.filter((ok) => !ok).length };
}
