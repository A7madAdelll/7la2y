import { AdminBoard, type AdminShop } from "@/app/admin/admin-board";

const shops: AdminShop[] = [
  { id: "1", name: "صالون النيل", slug: "salon-el-nil", created_at: "2026-11-01", owner_email: "owner1@example.com", sub_status: "active", sub_plan: "basic", paid_until: "2026-11-30", visits_this_month: 412, alerts_this_month: 96, haircuts_this_month: 371 },
  { id: "2", name: "حلاق الحسين", slug: "hussein-barber", created_at: "2026-10-20", owner_email: "owner2@example.com", sub_status: "active", sub_plan: "basic", paid_until: "2026-10-31", visits_this_month: 230, alerts_this_month: 41, haircuts_this_month: 204 },
  { id: "3", name: "استوديو فادي", slug: "fady-studio", created_at: "2026-11-02", owner_email: null, sub_status: null, sub_plan: null, paid_until: null, visits_this_month: 12, alerts_this_month: 0, haircuts_this_month: 9 },
];

export default function DemoAdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 pb-16">
      <h1 className="text-2xl font-bold">إدارة حلاقي</h1>
      <AdminBoard shops={shops} today="2026-11-03" />
    </main>
  );
}
