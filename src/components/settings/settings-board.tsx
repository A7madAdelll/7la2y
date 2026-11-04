"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Notice, cn } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import type { Category } from "@/lib/queue/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type SettingsShop = {
  id: string; name: string; slug: string; kinds: Category[]; queue_open: boolean; no_show_minutes: number; require_code: boolean;
};
export type SettingsBarber = { id: string; name: string; active: boolean; on_duty: boolean };
export type SettingsService = {
  id: string; name: string; category: Category; kind: "main" | "extra" | "package" | "hospitality";
  price_egp: number | null; minutes: number; active: boolean;
};

const CATEGORY: Record<Category, string> = { men: "رجالي", kids: "أطفال", women: "حريمي" };
const KIND: Record<SettingsService["kind"], string> = { main: "أساسي", extra: "إضافة", package: "باكج", hospitality: "ضيافة" };

/** Database/PostgREST error -> Arabic. Constraint violations mean a value outside the allowed range. */
function settingsError(e: { code?: string; message?: string }) {
  if (e.code === "23514" || e.code === "22P02") return "القيمة دي مش مقبولة. راجعها وجرب تاني.";
  if (e.code === "23503") return "الخدمة دي اتطلبت قبل كده فمينفعش تتمسح. اخفيها بدل كده.";
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

      <Card className="flex flex-col gap-2">
        <label htmlFor="no-show" className="text-lg font-bold">مهلة الرجوع بعد النداء</label>
        <p className="text-sm text-ink-soft">الزبون اللي برا المحل هيشوف الرقم ده لما يتنده عليه. بعدها تقدر تدوس «مجاش».</p>
        <div className="flex items-center gap-2">
          <input id="no-show" type="number" inputMode="numeric" min={3} max={60} dir="ltr" defaultValue={shop.no_show_minutes}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== shop.no_show_minutes && Number.isInteger(v) && v >= 3 && v <= 60) void save("shops", shop.id, { no_show_minutes: v });
              else if (v < 3 || v > 60) setError("المهلة من 3 لـ 60 دقيقة.");
            }}
            className="min-h-11 w-24 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-right" />
          <span>دقيقة</span>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-lg font-bold">كود المحل {shop.require_code ? "شغال" : "مقفول"}</span>
          <span className="text-sm text-ink-soft">
            {shop.require_code
              ? "الزبون لازم يكتب الكود اللي على الشاشة، فمحدش يحجز وهو برا المحل."
              : "أي حد معاه لينك المحل يقدر يحجز، حتى من بيته. مناسب لو إنت لوحدك وشايف اللي داخلين."}
          </span>
        </span>
        <Button size="md" variant="secondary" onClick={() => {
          if (shop.require_code && !confirm("لو قفلت الكود، أي حد معاه اللينك يقدر يحجز من برا المحل. تكمل؟")) return;
          void save("shops", shop.id, { require_code: !shop.require_code });
        }}>
          {shop.require_code ? "اقفله" : "شغّله"}
        </Button>
      </Card>

      <BarbersSection shopId={shop.id} barbers={barbers} save={save} onError={setError} />
      <ServicesSection shopId={shop.id} kinds={shop.kinds} services={services} save={save} onError={setError} />
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

function ServicesSection({ shopId, kinds, services, save, onError }: {
  shopId: string; kinds: Category[]; services: SettingsService[]; save: Save; onError: (m: string) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Category | "hospitality">(kinds[0] ?? "men");
  const shown = tab === "hospitality"
    ? services.filter((s) => s.kind === "hospitality")
    : services.filter((s) => s.category === tab && s.kind !== "hospitality");
  const missingPrices = services.filter((s) => s.active && s.price_egp === null && s.kind !== "hospitality").length;

  async function remove(s: SettingsService) {
    if (!confirm(`تمسح «${s.name}»؟`)) return;
    const { error } = await supabaseBrowser().from("services").delete().eq("id", s.id);
    if (error) return onError(settingsError(error));
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">الخدمات والأسعار</h2>
      {missingPrices > 0 && <Notice tone="warn">في {missingPrices} خدمة من غير سعر. الزبون هيشوف «السعر في المحل» لحد ما تكتبه.</Notice>}
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => <Chip key={k} selected={tab === k} onClick={() => setTab(k)}>{CATEGORY[k]}</Chip>)}
        <Chip selected={tab === "hospitality"} onClick={() => setTab("hospitality")}>ضيافة</Chip>
      </div>
      {shown.length === 0 && <p className="text-sm text-ink-soft">{tab === "hospitality" ? "ضيف شاي أو قهوة أو مية، بسعر أو ببلاش." : "مفيش خدمات هنا لسه."}</p>}
      {shown.map((s) => (
        <Card key={s.id} className={cn("flex flex-col gap-2.5", !s.active && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-soft">
              {KIND[s.kind]}
              <input defaultValue={s.name} maxLength={60} aria-label="اسم الخدمة"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) void save("services", s.id, { name: v }); }}
                className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-base font-medium text-ink" />
            </label>
          </div>
          <div className={cn("grid gap-2.5", s.kind === "hospitality" ? "grid-cols-1" : "grid-cols-2")}>
            <label className="flex flex-col gap-1 text-sm">
              السعر (ج.م){s.kind === "hospitality" && " — 0 يعني ببلاش"}
              <input type="number" inputMode="decimal" min={0} step="5" dir="ltr" defaultValue={s.price_egp ?? ""} placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== s.price_egp && (v === null || (Number.isFinite(v) && v >= 0))) void save("services", s.id, { price_egp: v });
                }}
                className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-right" />
            </label>
            {s.kind !== "hospitality" && (
              <label className="flex flex-col gap-1 text-sm">
                المدة (دقيقة)
                <input type="number" inputMode="numeric" min={1} max={600} dir="ltr" defaultValue={s.minutes}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== s.minutes && Number.isInteger(v) && v >= 1 && v <= 600) void save("services", s.id, { minutes: v });
                  }}
                  className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3 text-right" />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="md" variant="secondary" onClick={() => save("services", s.id, { active: !s.active })}>
              {s.active ? "اخفيها" : "اظهرها"}
            </Button>
            <Button size="md" variant="danger" onClick={() => remove(s)}>امسحها</Button>
          </div>
        </Card>
      ))}
      <AddService shopId={shopId} category={tab === "hospitality" ? (kinds[0] ?? "men") : tab} hospitality={tab === "hospitality"} onError={onError} />
    </section>
  );
}

/** New service / extra / package for the open tab, or a hospitality item (0 minutes). */
function AddService({ shopId, category, hospitality, onError }: {
  shopId: string; category: Category; hospitality: boolean; onError: (m: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"main" | "extra" | "package">("main");
  const [price, setPrice] = useState("");
  const [minutes, setMinutes] = useState("20");
  return (
    <form noValidate className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = name.trim();
        const m = hospitality ? 0 : Number(minutes);
        const p = price === "" ? null : Number(price);
        if (!n) return onError("اكتب اسم الخدمة.");
        if (!hospitality && !(Number.isInteger(m) && m >= 1 && m <= 600)) return onError("المدة من 1 لـ 600 دقيقة.");
        if (p !== null && !(Number.isFinite(p) && p >= 0)) return onError("السعر لازم يكون رقم موجب.");
        const { error } = await supabaseBrowser().from("services").insert({
          shop_id: shopId, name: n, category, kind: hospitality ? "hospitality" : kind, price_egp: p, minutes: m, sort: 100,
        });
        if (error) return onError(settingsError(error));
        setName(""); setPrice("");
        router.refresh();
      }}>
      <span className="font-medium">{hospitality ? "ضيافة جديدة" : "خدمة جديدة"}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="اسم الخدمة الجديدة"
        placeholder={hospitality ? "مثلاً: شاي" : "مثلاً: قصة + غسيل"}
        className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-surface px-3" />
      {!hospitality && (
        <div className="flex flex-wrap gap-2">
          {(["main", "extra", "package"] as const).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{KIND[k]}</Chip>
          ))}
        </div>
      )}
      <div className={cn("grid gap-2.5", hospitality ? "grid-cols-1" : "grid-cols-2")}>
        <input type="number" inputMode="decimal" min={0} dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)}
          aria-label="السعر بالجنيه" placeholder={hospitality ? "السعر (0 = ببلاش)" : "السعر"}
          className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-surface px-3 text-right" />
        {!hospitality && (
          <input type="number" inputMode="numeric" min={1} max={600} dir="ltr" value={minutes} onChange={(e) => setMinutes(e.target.value)}
            aria-label="المدة بالدقايق" placeholder="المدة"
            className="min-h-11 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-surface px-3 text-right" />
        )}
      </div>
      <Button type="submit" size="md" variant="outline">أضف</Button>
    </form>
  );
}
