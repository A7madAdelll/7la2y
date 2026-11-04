"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Chip, Notice, TextField, cn } from "@/components/ui";
import { ERROR_MESSAGES, errorMessage } from "@/lib/errors";
import { formatEGP, formatMinutes, formatPeople } from "@/lib/format";
import { summarize, validateJoin, type JoinFieldErrors } from "@/lib/queue/join-validation";
import type { Category, JoinInput, ShopPublic } from "@/lib/queue/types";

const CATEGORY_LABEL: Record<Category, string> = { men: "رجالي", kids: "أطفال", women: "حريمي" };

type Props = {
  shop: ShopPublic;
  /** Calls public.join_queue. Throws/returns the DB error key on failure. */
  onJoin: (input: JoinInput) => Promise<void>;
};

export function JoinForm({ shop, onJoin }: Props) {
  const categories = shop.kinds.filter((k) => shop.services.some((s) => s.category === k));
  const [category, setCategory] = useState<Category>(categories[0] ?? "men");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [mainId, setMainId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [wantsAlert, setWantsAlert] = useState(false);
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mains = shop.services.filter((s) => s.category === category && (s.kind === "main" || s.kind === "package"));
  const extras = shop.services.filter((s) => s.category === category && s.kind === "extra");
  // Tea / coffee / water: offered with any category, never lengthens the wait.
  const hospitality = shop.services.filter((s) => s.kind === "hospitality");
  const requireCode = shop.require_code !== false;
  const serviceIds = useMemo(() => (mainId ? [mainId, ...extraIds] : extraIds), [mainId, extraIds]);
  const total = summarize(serviceIds, shop.services);

  if (!shop.queue_open) {
    return (
      <div className="p-5">
        <Notice tone="warn">{ERROR_MESSAGES.queue_closed}</Notice>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: JoinInput = { name, phone, code, barberId, serviceIds, wantsAlert };
    const found = validateJoin(input, shop.services, requireCode);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await onJoin(input);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const msg = (k?: keyof typeof ERROR_MESSAGES) => (k ? ERROR_MESSAGES[k] : undefined);

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6 p-5">
      <section className="flex flex-col gap-4">
        <TextField label="اسمك" autoComplete="given-name" placeholder="مثلاً: أحمد" value={name}
          onChange={(e) => setName(e.target.value)} error={msg(errors.name)} />
        <TextField label="رقم الموبايل" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr"
          className="text-right" placeholder="01xxxxxxxxx" value={phone}
          onChange={(e) => setPhone(e.target.value)} error={msg(errors.phone)} />
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-bold">عايز تعمل إيه؟</legend>
        {categories.length > 1 && (
          <div className="grid grid-cols-2 rounded-[var(--radius-control)] bg-sunken p-1">
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c}
                onClick={() => { setCategory(c); setMainId(null); setExtraIds((ids) => ids.filter((id) => hospitality.some((h) => h.id === id))); }}
                className={cn("min-h-11 cursor-pointer rounded-[9px] text-[15px] font-medium",
                  category === c ? "bg-surface text-ink" : "text-ink-soft")}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}
        <div role="radiogroup" aria-label="الخدمة الأساسية" className="flex flex-col gap-2">
          {mains.map((s) => {
            const on = mainId === s.id;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setMainId(s.id)}
                className={cn("flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] px-4 py-2.5 text-start",
                  on ? "border-2 border-brand bg-brand-tint" : "border-[1.5px] border-line bg-surface")}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-medium">{s.name}</span>
                  <span className="text-[13px] text-ink-soft">{formatMinutes(s.minutes)}</span>
                </span>
                {s.price_egp !== null && <span className="text-[15px] font-bold">{formatEGP(s.price_egp)}</span>}
              </button>
            );
          })}
        </div>
        {extras.length > 0 && (
          <>
            <h3 className="mt-1 text-[15px] font-medium">إضافات (اختياري)</h3>
            <div className="flex flex-wrap gap-2">
              {extras.map((s) => (
                <Chip key={s.id} selected={extraIds.includes(s.id)}
                  onClick={() => setExtraIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}>
                  {s.name}{s.price_egp !== null && ` · ${formatEGP(s.price_egp)}`}
                </Chip>
              ))}
            </div>
          </>
        )}
        {hospitality.length > 0 && (
          <>
            <h3 className="mt-1 text-[15px] font-medium">ضيافة</h3>
            <div className="flex flex-wrap gap-2">
              {hospitality.map((s) => (
                <Chip key={s.id} selected={extraIds.includes(s.id)}
                  onClick={() => setExtraIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}>
                  {s.name}{s.price_egp ? ` · ${formatEGP(s.price_egp)}` : s.price_egp === 0 ? " · ببلاش" : ""}
                </Chip>
              ))}
            </div>
          </>
        )}
        {errors.services && <p role="alert" className="text-sm text-danger">{ERROR_MESSAGES[errors.services]}</p>}
      </fieldset>

      {shop.barbers.length > 1 && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-lg font-bold">مع مين؟</legend>
          <div className="flex flex-wrap gap-2">
            <Chip selected={barberId === null} onClick={() => setBarberId(null)}>أي حلاق (أسرع)</Chip>
            {shop.barbers.map((b) => (
              <Chip key={b.id} selected={barberId === b.id} onClick={() => setBarberId(b.id)}>{b.name}</Chip>
            ))}
          </div>
        </fieldset>
      )}

      {requireCode && (
        <TextField label="كود المحل" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={4}
          placeholder="• • • •" className="text-center text-[28px] tracking-[14px]" value={code}
          onChange={(e) => setCode(e.target.value)} error={msg(errors.code)}
          hint="مكتوب على شاشة الكاشير والتلفزيون جوه المحل." />
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface p-3.5">
        <input type="checkbox" checked={wantsAlert} onChange={(e) => setWantsAlert(e.target.checked)}
          className="mt-0.5 size-[22px] shrink-0 accent-brand" />
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-medium">ابعتلي واتساب لما يفضل قدامي {formatPeople(2)}</span>
          <span className="text-[13px] text-ink-soft">لو هتخرج تتمشى. رسالة واحدة بس.</span>
        </span>
      </label>

      {formError && <Notice tone="error">{formError}</Notice>}

      <div className="sticky bottom-0 -mx-5 flex flex-col gap-2.5 bg-paper px-5 pt-2 pb-4">
        {total.count > 0 && (
          <div className="flex justify-between text-[15px]">
            {total.price !== null ? <span>الإجمالي: <b>{formatEGP(total.price)}</b></span> : <span />}
            <span className="text-ink-soft">حوالي {formatMinutes(total.minutes)}</span>
          </div>
        )}
        <Button type="submit" block disabled={busy}>{busy ? "لحظة…" : "احجز دوري"}</Button>
        <p className="text-center text-xs text-ink-soft">
          رقمك بيستخدم للدور ده بس، وبيتمسح بعد 90 يوم من آخر زيارة. <Link href="/privacy" className="underline">الخصوصية</Link>
        </p>
      </div>
    </form>
  );
}
