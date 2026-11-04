// In-memory imitation of the queue functions, ONLY for the /demo counter screen.
// The real rules live in Postgres (supabase/migrations); this copies their behaviour so the
// demo feels real: "next" ignores stale presses, honours the requested barber, etc.
import type { CounterState } from "./types";

export type DemoAction =
  | { type: "next"; barberId: string; expectedCurrent: string | null }
  | { type: "no_show"; entryId: string }
  | { type: "move"; entryId: string; delta: -1 | 1 }
  | { type: "walk_in"; name: string; service: string }
  | { type: "toggle_open" }
  | { type: "toggle_duty"; barberId: string };

let walkInSeq = 100;

export function demoReducer(state: CounterState, action: DemoAction): CounterState {
  switch (action.type) {
    case "next": {
      const barber = state.barbers.find((b) => b.id === action.barberId);
      if (!barber || (barber.serving?.id ?? null) !== action.expectedCurrent) return state; // stale press
      const idx = state.waiting.findIndex((e) => e.requested_barber_id === barber.id || e.requested_barber_id === null);
      const next = idx >= 0 ? state.waiting[idx] : null;
      return {
        ...state,
        waiting: idx >= 0 ? state.waiting.filter((_, i) => i !== idx) : state.waiting,
        barbers: state.barbers.map((b) =>
          b.id === barber.id ? { ...b, serving: next ? { ...next, called_at: new Date().toISOString() } : null } : b,
        ),
      };
    }
    case "no_show":
      return {
        ...state,
        waiting: state.waiting.filter((e) => e.id !== action.entryId),
        barbers: state.barbers.map((b) => (b.serving?.id === action.entryId ? { ...b, serving: null } : b)),
      };
    case "move": {
      const i = state.waiting.findIndex((e) => e.id === action.entryId);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= state.waiting.length) return state;
      const waiting = [...state.waiting];
      [waiting[i], waiting[j]] = [waiting[j], waiting[i]];
      return { ...state, waiting };
    }
    case "walk_in": {
      const maxTicket = Math.max(0, ...state.waiting.map((e) => e.ticket_no), ...state.barbers.map((b) => b.serving?.ticket_no ?? 0));
      return {
        ...state,
        waiting: [
          ...state.waiting,
          { id: `w${++walkInSeq}`, ticket_no: maxTicket + 1, customer_name: action.name, services: [action.service], requested_barber_id: null, wants_alert: false, is_walk_in: true },
        ],
      };
    }
    case "toggle_open":
      return { ...state, shop: { ...state.shop, queue_open: !state.shop.queue_open } };
    case "toggle_duty":
      return { ...state, barbers: state.barbers.map((b) => (b.id === action.barberId ? { ...b, on_duty: !b.on_duty } : b)) };
  }
}
