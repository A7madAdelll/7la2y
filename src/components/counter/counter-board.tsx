"use client";

import { useState } from "react";
import { Button, Card, cn } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import type { CounterBarber, CounterEntry, CounterState } from "@/lib/queue/types";
import { PresenceCode } from "./presence-code";

export type CounterHandlers = {
  /** public.queue_next(barber, expectedCurrent) */
  onNext: (barberId: string, expectedCurrent: string | null) => void;
  /** public.queue_no_show(entry) */
  onNoShow: (entryId: string) => void;
  /** public.queue_reorder(...) — one step up or down */
  onMove: (entryId: string, delta: -1 | 1) => void;
  /** public.staff_add_walk_in(...) */
  onWalkIn: (name: string) => void;
  /** public.set_queue_open(...) */
  onToggleOpen: () => void;
  /** public.set_barber_on_duty(...) */
  onToggleDuty: (barberId: string) => void;
};

const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export function CounterBoard({ state, ...h }: { state: CounterState } & CounterHandlers) {
  const nameOf = (id: string | null) => (id ? (state.barbers.find((b) => b.id === id)?.name ?? "") : "أي حلاق");
  const upNext = (b: CounterBarber) =>
    state.waiting.find((e) => e.requested_barber_id === b.id || e.requested_barber_id === null);
  const serving = state.barbers.filter((b) => b.serving).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-ink px-4 py-3.5 text-paper sm:px-6">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold">{state.shop.name}</h1>
          <span className="text-[13px] text-[#c9cdd2]">{state.waiting.length} مستنيين · {serving} في الكرسي</span>
        </div>
        <div className="ms-auto">
          <PresenceCode code={state.presence.code} expiresAt={state.presence.expires_at} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={state.shop.queue_open} onChange={h.onToggleOpen} className="size-[22px] accent-[#2ba39b]" />
          الطابور {state.shop.queue_open ? "مفتوح" : "مقفول"}
        </label>
      </header>

      <main className="flex flex-1 flex-col gap-5 p-4 lg:flex-row sm:p-6">
        <section aria-label="الحلاقين" className="grid flex-1 content-start gap-4 sm:grid-cols-2">
          {state.barbers.map((b) => (
            <BarberCard key={b.id} barber={b} next={upNext(b)} {...h} />
          ))}
        </section>
        <WaitingList waiting={state.waiting} nameOf={nameOf} {...h} />
      </main>
    </div>
  );
}

function BarberCard({ barber: b, next, onNext, onNoShow, onToggleDuty }: { barber: CounterBarber; next?: CounterEntry } & CounterHandlers) {
  return (
    <Card className={cn("flex flex-col gap-3.5 rounded-[18px] p-4.5", !b.on_duty && "opacity-70")}>
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-bold">{b.name}</h2>
        <button type="button" aria-pressed={b.on_duty} onClick={() => onToggleDuty(b.id)}
          className={cn("min-h-11 cursor-pointer rounded-full px-3 text-[13px]",
            b.on_duty ? "bg-brand-tint text-brand-strong" : "bg-sunken text-ink-soft")}>
          {b.on_duty ? "شغال النهارده" : "مش موجود النهارده"}
        </button>
      </div>
      <div className="flex min-h-[112px] flex-col justify-center gap-1.5 rounded-[14px] bg-paper p-3.5">
        {b.serving ? (
          <>
            <span className="text-[13px] text-ink-soft">في الكرسي · بقاله {formatMinutes(minutesSince(b.serving.called_at))}</span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[30px] font-bold tabular-nums">{b.serving.ticket_no}</span>
              <span className="text-xl font-medium">{b.serving.customer_name}</span>
            </div>
            <span className="text-sm text-ink-soft">{b.serving.services.join(" · ")}</span>
          </>
        ) : (
          <span className="text-ink-soft">الكرسي فاضي</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Button size="xl" className="col-span-2" disabled={!b.on_duty || (!b.serving && !next)}
          onClick={() => onNext(b.id, b.serving?.id ?? null)}>
          {b.serving ? "خلص، التالي" : "نده التالي"}
        </Button>
        <Button size="xl" variant="secondary" className="text-base font-medium" disabled={!b.serving}
          onClick={() => b.serving && onNoShow(b.serving.id)}>
          مجاش
        </Button>
      </div>
      <span className="text-sm text-ink-soft">
        {next ? `اللي عليه: ${next.ticket_no} ${next.customer_name}` : "مفيش حد مستني ليه"}
      </span>
    </Card>
  );
}

function WaitingList({ waiting, nameOf, onMove, onNoShow, onWalkIn }: { waiting: CounterEntry[]; nameOf: (id: string | null) => string } & CounterHandlers) {
  const [adding, setAdding] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  return (
    <aside aria-label="المستنيين" className="flex flex-col rounded-[18px] border-[1.5px] border-line bg-surface lg:w-[420px]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4.5 py-4">
        <h2 className="text-lg font-bold">المستنيين ({waiting.length})</h2>
        <Button variant="outline" size="md" onClick={() => setAdding((a) => !a)}>+ زبون من غير موبايل</Button>
      </div>
      {adding && (
        <form className="flex gap-2 border-b border-line p-3"
          onSubmit={(e) => { e.preventDefault(); if (walkInName.trim()) { onWalkIn(walkInName.trim()); setWalkInName(""); setAdding(false); } }}>
          <label className="sr-only" htmlFor="walkin">اسم الزبون</label>
          <input id="walkin" autoFocus value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="اسم الزبون"
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border-[1.5px] border-line-strong px-3" />
          <Button type="submit" size="md">أضف</Button>
        </form>
      )}
      {waiting.length === 0 ? (
        <p className="p-6 text-center text-ink-soft">مفيش حد مستني.</p>
      ) : (
        <ol className="flex flex-col px-2.5 py-1.5">
          {waiting.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2.5 border-b border-[#efede7] px-1.5 py-2 last:border-0">
              <span className="w-9 text-[22px] font-bold tabular-nums">{e.ticket_no}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-medium">{e.customer_name}</span>
                <span className="truncate text-[13px] text-ink-soft">
                  {e.services.join(" · ")}{e.is_walk_in && " · من غير موبايل"}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1 text-[13px]">
                <span className={e.requested_barber_id ? "rounded-full bg-paper px-2 py-0.5" : "text-ink-soft"}>{nameOf(e.requested_barber_id)}</span>
                {e.wants_alert && <span className="text-warn">واتساب</span>}
              </span>
              <span className="flex">
                <button type="button" aria-label={`طلّع ${e.customer_name} لفوق`} disabled={i === 0}
                  onClick={() => onMove(e.id, -1)}
                  className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-sunken disabled:opacity-30">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
                </button>
                <button type="button" aria-label={`نزّل ${e.customer_name} لتحت`} disabled={i === waiting.length - 1}
                  onClick={() => onMove(e.id, 1)}
                  className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-sunken disabled:opacity-30">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <button type="button" aria-label={`${e.customer_name} مجاش`} onClick={() => onNoShow(e.id)}
                  className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-sunken">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
