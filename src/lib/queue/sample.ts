// Sample data for the /demo screens until Supabase staging is connected.
// Shapes match the database functions exactly (see types.ts). Prices are null: owners set them.
import type { CounterState, EntryStatus, PublicService, ShopPublic } from "./types";

const s = (id: string, name: string, category: PublicService["category"], kind: PublicService["kind"], minutes: number): PublicService => ({
  id, name, category, kind, minutes, price_egp: null,
});

export const sampleShop: ShopPublic = {
  id: "shop-1",
  name: "صالون [اسم المحل]",
  kinds: ["men", "kids"],
  queue_open: true,
  waiting_count: 6,
  barbers: [
    { id: "b1", name: "محمد" },
    { id: "b2", name: "كريم" },
  ],
  services: [
    s("m1", "قصة شعر", "men", "main", 20),
    s("m2", "قصة + دقن", "men", "main", 30),
    s("m3", "حلاقة دقن", "men", "main", 10),
    s("m4", "حلاقة زيرو", "men", "main", 15),
    s("m5", "باكج عريس", "men", "package", 90),
    s("e1", "فوطة سخنة", "men", "extra", 10),
    s("e2", "ماسك وش", "men", "extra", 15),
    s("e3", "غسيل شعر", "men", "extra", 10),
    s("e4", "تنظيف بشرة", "men", "extra", 25),
    s("e5", "مساج رأس", "men", "extra", 10),
    s("k1", "قصة أطفال", "kids", "main", 15),
    s("k2", "أول قصة", "kids", "main", 20),
    s("k3", "قصة + تحديد", "kids", "main", 20),
    { id: "h1", name: "شاي", category: "men", kind: "hospitality", minutes: 0, price_egp: 0 },
    { id: "h2", name: "قهوة", category: "men", kind: "hospitality", minutes: 0, price_egp: 15 },
  ],
};

export const sampleStatus: EntryStatus = {
  status: "waiting",
  ticket_no: 14,
  shop_name: sampleShop.name,
  barber_name: null,
  ahead: 3,
  estimated_minutes: 35,
  services: [
    { name: "قصة + دقن", price_egp: null, minutes: 30 },
    { name: "فوطة سخنة", price_egp: null, minutes: 10 },
  ],
  wants_alert: true,
  no_show_minutes: 10,
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function sampleCounter(): CounterState {
  return {
    shop: { id: sampleShop.id, name: sampleShop.name, queue_open: true },
    presence: { code: "4827", expires_at: new Date(Date.now() + 192_000).toISOString() },
    barbers: [
      {
        id: "b1", name: "محمد", on_duty: true,
        serving: { id: "q12", ticket_no: 12, customer_name: "أحمد", services: ["قصة + دقن", "فوطة سخنة"], requested_barber_id: null, wants_alert: false, is_walk_in: false, called_at: minutesAgo(12) },
      },
      {
        id: "b2", name: "كريم", on_duty: true,
        serving: { id: "q11", ticket_no: 11, customer_name: "يوسف", services: ["حلاقة زيرو"], requested_barber_id: "b2", wants_alert: false, is_walk_in: false, called_at: minutesAgo(4) },
      },
    ],
    waiting: [
      { id: "q13", ticket_no: 13, customer_name: "كريم", services: ["قصة أطفال"], requested_barber_id: null, wants_alert: false, is_walk_in: false },
      { id: "q14", ticket_no: 14, customer_name: "مصطفى", services: ["قصة + دقن", "ماسك وش"], requested_barber_id: "b2", wants_alert: false, is_walk_in: false },
      { id: "q15", ticket_no: 15, customer_name: "عمر", services: ["قصة شعر"], requested_barber_id: null, wants_alert: true, is_walk_in: false },
      { id: "q16", ticket_no: 16, customer_name: "زبون", services: ["حلاقة دقن"], requested_barber_id: null, wants_alert: false, is_walk_in: true },
      { id: "q17", ticket_no: 17, customer_name: "حسن", services: ["باكج عريس"], requested_barber_id: "b1", wants_alert: false, is_walk_in: false },
    ],
  };
}
