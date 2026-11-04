import type { CounterState, TvData } from "./types";

/** Same projection tv_board() does in the database (used by the /demo TV on sample data). */
export function tvFromCounter(c: CounterState): TvData {
  return {
    shop_id: c.shop.id,
    shop_name: c.shop.name,
    queue_open: c.shop.queue_open,
    code: c.presence.code,
    expires_at: c.presence.expires_at,
    barbers: c.barbers.filter((b) => b.on_duty).map((b) => ({ name: b.name, serving_ticket: b.serving?.ticket_no ?? null })),
    next: c.waiting.slice(0, 5).map((e) => e.ticket_no),
  };
}
