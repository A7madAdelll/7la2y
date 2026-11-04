// Shapes returned by the database functions in supabase/migrations (keep in sync).

export type ServiceKind = "main" | "extra" | "package" | "hospitality";
export type Category = "men" | "women" | "kids";

export type PublicService = {
  id: string;
  name: string;
  category: Category;
  kind: ServiceKind;
  price_egp: number | null;
  minutes: number;
};

/** public.shop_public(slug) */
export type ShopPublic = {
  id: string;
  name: string;
  kinds: Category[];
  queue_open: boolean;
  /** false = the shop switched the rotating presence code off */
  require_code?: boolean;
  waiting_count: number;
  barbers: { id: string; name: string }[];
  services: PublicService[];
};

export type EntryStatusValue = "waiting" | "serving" | "done" | "no_show" | "left" | "cancelled";

/** public.entry_status(token) */
export type EntryStatus = {
  status: EntryStatusValue;
  ticket_no: number;
  shop_name: string;
  barber_name: string | null;
  ahead: number | null;
  estimated_minutes: number | null;
  services: { name: string; price_egp: number | null; minutes: number }[];
  wants_alert: boolean;
  /** Set while serving: when they were called, and the shop's no-show limit. */
  called_at?: string | null;
  no_show_minutes?: number;
  /** The customer confirmed their number on WhatsApp (the link was sent there). */
  whatsapp_confirmed?: boolean;
};

/** Input of public.join_queue(...) */
export type JoinInput = {
  name: string;
  phone: string;
  code: string;
  barberId: string | null;
  serviceIds: string[];
  wantsAlert: boolean;
};

/** Counter screen: built from the staff-readable tables (RLS-scoped to the shop). */
export type CounterEntry = {
  id: string;
  ticket_no: number;
  customer_name: string;
  services: string[];
  requested_barber_id: string | null;
  wants_alert: boolean;
  is_walk_in: boolean;
};

export type CounterBarber = {
  id: string;
  name: string;
  on_duty: boolean;
  serving: (CounterEntry & { called_at: string }) | null;
};

export type CounterState = {
  shop: { id: string; name: string; queue_open: boolean; require_code?: boolean; no_show_minutes?: number };
  presence: { code: string; expires_at: string };
  barbers: CounterBarber[];
  waiting: CounterEntry[];
};

/** public.tv_board(token): what the waiting-room TV may show. Ticket numbers only, no names. */
export type TvData = {
  shop_id: string;
  slug?: string;
  shop_name: string;
  queue_open: boolean;
  code: string;
  expires_at: string;
  barbers: { name: string; serving_ticket: number | null }[];
  next: number[];
};
