"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Notice, TextField, cn } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { amountDue, invoiceText, PRICE_PER_HAIRCUT_EGP, whatsappLink } from "@/lib/billing";
import { formatDate, formatEGP } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type AdminShop = {
  id: string; name: string; slug: string; created_at: string; owner_email: string | null;
  sub_status: string | null; sub_plan: string | null; paid_until: string | null;
  visits_this_month: number; alerts_this_month: number; haircuts_this_month: number;
  service_on: boolean;
};

const METHODS = [
  ["instapay", "InstaPay"],
  ["vodafone_cash", "Vodafone Cash"],
  ["cash", "كاش"],
  ["other", "تاني"],
] as const;

/** Default period: today (Cairo, YYYY-MM-DD) to the day before the same date next month. */
export function defaultPeriod(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return { start: today, end: d.toISOString().slice(0, 10) };
}

function statusLabel(s: AdminShop, today: string) {
  if (!s.sub_status) return { text: "تجربة / مدفعش", tone: "bg-sunken text-ink-soft" };
  if (s.paid_until && s.paid_until < today) return { text: `انتهى ${formatDate(s.paid_until)}`, tone: "bg-danger-tint text-danger" };
  return { text: `مدفوع لحد ${formatDate(s.paid_until ?? "")}`, tone: "bg-brand-tint text-brand-strong" };
}

/** `today` = Cairo date (YYYY-MM-DD) from the server, so every screen agrees on what "expired" means. */
export function AdminBoard({ shops, today }: { shops: AdminShop[]; today: string }) {
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<string | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? shops.filter((s) => `${s.name} ${s.slug} ${s.owner_email ?? ""}`.toLowerCase().includes(t)) : shops;
  }, [q, shops]);
  const paid = shops.filter((s) => statusLabel(s, today).tone.includes("brand")).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col"><span className="text-sm text-ink-soft">محلات</span><span className="text-2xl font-bold">{shops.length}</span></Card>
        <Card className="flex flex-col"><span className="text-sm text-ink-soft">مستحق الشهر</span><span className="text-2xl font-bold">{formatEGP(amountDue(shops.reduce((a, s) => a + Number(s.haircuts_this_month), 0)))}</span></Card>
        <Card className="flex flex-col"><span className="text-sm text-ink-soft">رسايل الشهر</span><span className="text-2xl font-bold">{shops.reduce((a, s) => a + Number(s.alerts_this_month), 0)}</span></Card>
      </div>
      <p className="text-sm text-ink-soft">
        السعر: {formatEGP(PRICE_PER_HAIRCUT_EGP)} على كل حلاقة خلصت. اللي مجاش أو خرج من الدور مش بيتحسب. {paid} محل مسجل ليه دفعة سارية.
      </p>
      <TextField label="دور على محل" placeholder="الاسم أو الرابط أو الإيميل" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map((s) => {
        const st = statusLabel(s, today);
        return (
          <Card key={s.id} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="flex flex-col">
                <span className="font-bold">{s.name}</span>
                <span dir="ltr" className="text-right text-[13px] text-ink-soft">/{s.slug} · {s.owner_email ?? "—"}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={cn("rounded-full px-2.5 py-1 text-[13px]", st.tone)}>{st.text}</span>
                {!s.service_on && <span className="rounded-full bg-danger-tint px-2.5 py-1 text-[13px] text-danger">الخدمة مقفولة</span>}
              </span>
            </div>
            <span className="text-sm text-ink-soft">
              الشهر ده: {s.haircuts_this_month} حلاقة خلصت (من {s.visits_this_month} حجز) · {s.alerts_this_month} رسالة واتساب
            </span>
            <span className="font-bold">المستحق: {formatEGP(amountDue(Number(s.haircuts_this_month)))}</span>
            {paying === s.id ? (
              <PaymentForm shopId={s.id} today={today} onDone={() => setPaying(null)} />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <a href={whatsappLink(invoiceText(s.name, Number(s.haircuts_this_month)))} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-[14px] border-[1.5px] border-brand bg-surface px-2 text-[15px] font-bold text-brand hover:bg-brand-tint">
                  ابعت الفاتورة
                </a>
                <Button size="md" variant="outline" onClick={() => setPaying(s.id)}>سجّل دفعة</Button>
                <ServiceSwitch shop={s} />
              </div>
            )}
          </Card>
        );
      })}
      {shown.length === 0 && <Notice>مفيش محلات بالبحث ده.</Notice>}
    </div>
  );
}

/** Turns the shop's service on/off. Off blocks new joins only; people already waiting are served. */
function ServiceSwitch({ shop }: { shop: AdminShop }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="md" variant={shop.service_on ? "danger" : "primary"} onClick={async () => {
        if (shop.service_on && !window.confirm(`تقفل الخدمة على ${shop.name}؟ محدش جديد هيعرف يدخل الدور.`)) return;
        const { error: err } = await supabaseBrowser().rpc("admin_set_service", { p_shop_id: shop.id, p_enabled: !shop.service_on });
        if (err) return setError(errorMessage(err));
        router.refresh();
      }}>
        {shop.service_on ? "اقفل الخدمة" : "افتح الخدمة"}
      </Button>
      {error && <div className="col-span-3"><Notice tone="error">{error}</Notice></div>}
    </>
  );
}

function PaymentForm({ shopId, today, onDone }: { shopId: string; today: string; onDone: () => void }) {
  const router = useRouter();
  const period = defaultPeriod(today);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("instapay");
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form noValidate className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-paper p-3" onSubmit={async (e) => {
      e.preventDefault();
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) return setError("اكتب المبلغ.");
      const { error: err } = await supabaseBrowser().rpc("admin_record_payment", {
        p_shop_id: shopId, p_plan: "basic", p_amount_egp: value, p_method: method,
        p_period_start: start, p_period_end: end, p_note: note || null,
      });
      if (err) return setError(errorMessage(err));
      onDone();
      router.refresh();
    }}>
      <TextField label="المبلغ (ج.م)" type="number" inputMode="decimal" dir="ltr" className="text-right" value={amount}
        onChange={(e) => setAmount(e.target.value)} hint={amount ? formatEGP(Number(amount)) : undefined} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        طريقة الدفع
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="min-h-13 rounded-[var(--radius-control)] border-[1.5px] border-line-strong bg-surface px-3">
          {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField label="من" type="date" dir="ltr" value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label="لحد" type="date" dir="ltr" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <TextField label="ملاحظة (اختياري)" placeholder="رقم العملية مثلاً" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" size="md">سجّل</Button>
        <Button size="md" variant="secondary" onClick={onDone}>إلغاء</Button>
      </div>
    </form>
  );
}
