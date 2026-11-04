"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Notice, cn } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import type { Category } from "@/lib/queue/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type SettingsShop = { id: string; name: string; slug: string; kinds: Category[]; queue_open: boolean };
export type SettingsBarber = { id: string; name: string; active: boolean; on_duty: boolean };
export type SettingsService = {
  id: string; name: string; category: Category; kind: "main" | "extra" | "package";
  price_egp: number | null; minutes: number; active: boolean;
};

const CATEGORY: Record<Category, string> = { men: "رجالي", kids: "أطفال", women: "حريمي" };
const KIND: Record<SettingsService["kind"], string> = { main: "أساسي", extra: "إضافة", package: "باكج" };

/** Database/PostgREST error -> Arabic. Constraint violations mean a value outside the allowed range. */
function settingsError(e: { code?: string; message?: string }) {
  if (e.code === "23514" || e.code === "22P02") return "القيمة دي مش مقبولة. راجعها وجرب تاني.";
  return errorMessage(e);
}

export function SettingsBoard({ shop, barbers, services }: { shop: SettingsShop; barbers: SettingsBarber[]; services: SettingsService[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  /** Every change is one row update through RLS (owner-only policies), then the page reloads data. */
  async function save(table: "shops" | "barbers" | "services", id: string, values: Record<string, unknown>, label = "اتحفظ") {
    setError(null);
    const { error: e } = await supabaseBrowser().from(table).update(values).eq("id", id);
    if (e) return setError(settingsError(e));
    setSaved(label);
    setTimeout(() => setSaved(null), 2000);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="fixed inset-x-4 bottom-4 z-10 flex flex-col gap-2">
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice>{saved}</Notice>}
      </div>

      <Card className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-lg font-bold">الطابور {shop.queue_open ? "مفتوح" : "مقفول"}</span>
          <span className="text-sm text-ink-soft">لما يتقفل محدش يقدر يحجز من الـ QR.</span>
        </span>
        <Button variant={shop.queue_open ? "secondary" : "primary"} size="md"
          onClick={async () => {
            const { error: e } = await supabaseBrowser().rpc("set_queue_open", { p_shop_id: shop.id, p_open: !shop.queue_open });
            if (e) setError(settingsError(e)); else router.refresh();
          }}>
          {shop.queue_open ? "اقفل الطابور" : "افتح الطابور"}
        </Button>
      </Card>

      <BarbersSection shopId={shop.id} barbers={barbers} save={save} onError={setError} />
      <ServicesSection kinds={shop.kinds} services={services} save={save} />
    </div>
  );
}

type Save = (table: "shops" | "barbers" | "services", id: string, values: Record<string, unknown>, label?: string) => Promise<void>;

function BarbersSection({ shopId, barbers, save, onError }: { shopId: string; barbers: SettingsBarber[]; save: Save; onError: (m: string) => void }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">الحلاقين</h2>
      {barbers.length === 0 && <Notice tone="warn">ضيف حلاق واحد على الأقل عشان الطابور يشتغل.</Notice>}
      {barbers.map((b) => (
        <Card key={b.id} className={cn("flex flex-wrap items-center gap-2", !b.active && "opacity-60")}>
          <label className="sr-only" htmlFor={`b-${b.id}`}>اسم الحلاق</label>
          <input id={`b-${b.id}`} defaultValue={b.name} maxLength={40}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== b.name && save("barbers", b.id, { name: e.target.value.trim() })}
            className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3" />
          <Button size="md" variant="secondary" onClick={() => save("barbers", b.id, { active: !b.active })}>
            {b.active ? "وقّفه" : "رجّعه"}
          </Button>
        </Card>
      ))}
      <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        const { error } = await supabaseBrowser().from("barbers").insert({ shop_id: shopId, name });
        if (error) return onError(settingsError(error));
        setNewName("");
        router.refresh();
      }}>
        <label className="sr-only" htmlFor="new-barber">اسم حلاق جديد</label>
        <input id="new-barber" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="اسم حلاق جديد"
          className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-surface px-3" />
        <Button type="submit" size="md">أضف</Button>
      </form>
    </section>
  );
}

function ServicesSection({ kinds, services, save }: { kinds: Category[]; services: SettingsService[]; save: Save }) {
  const [tab, setTab] = useState<Category>(kinds[0] ?? "men");
  const shown = services.filter((s) => s.category === tab);
  const missingPrices = services.filter((s) => s.active && s.price_egp === null).length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">الخدمات والأسعار</h2>
      {missingPrices > 0 && <Notice tone="warn">في {missingPrices} خدمة من غير سعر. الزبون هيشوف «السعر في المحل» لحد ما تكتبه.</Notice>}
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => <Chip key={k} selected={tab === k} onClick={() => setTab(k)}>{CATEGORY[k]}</Chip>)}
        </div>
      )}
      {shown.map((s) => (
        <Card key={s.id} className={cn("flex flex-col gap-2.5", !s.active && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-[13px] text-ink-soft">{KIND[s.kind]}</span>
            </span>
            <Button size="md" variant="secondary" onClick={() => save("services", s.id, { active: !s.active })}>
              {s.active ? "اخفيها" : "اظهرها"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-sm">
              السعر (ج.م)
              <input type="number" inputMode="decimal" min={0} step="5" dir="ltr" defaultValue={s.price_egp ?? ""} placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== s.price_egp && (v === null || (Number.isFinite(v) && v >= 0))) void save("services", s.id, { price_egp: v });
                }}
                className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-right" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              المدة (دقيقة)
              <input type="number" inputMode="numeric" min={1} max={600} dir="ltr" defaultValue={s.minutes}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== s.minutes && Number.isInteger(v) && v >= 1 && v <= 600) void save("services", s.id, { minutes: v });
                }}
                className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-right" />
            </label>
          </div>
        </Card>
      ))}
    </section>
  );
}
