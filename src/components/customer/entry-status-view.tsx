"use client";

import { useState } from "react";
import { Button, Card, Notice, Ticket } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatEGP, formatMinutes, formatPeople } from "@/lib/format";
import type { EntryStatus } from "@/lib/queue/types";

const ENDED: Record<string, string> = {
  done: "نعيماً! شكراً إنك جيت.",
  left: "خرجت من الدور. تقدر تحجز تاني من الـ QR في المحل.",
  no_show: "اتنده عليك ومكنتش موجود، فدورك اتلغى. اسأل الكاشير لو لسه في المحل.",
  cancelled: "الكاشير شال دورك. اسأل في المحل.",
};

type Props = {
  status: EntryStatus;
  /** Calls public.leave_queue(token). */
  onLeave: () => Promise<void>;
};

export function EntryStatusView({ status, onLeave }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = status.services.some((s) => s.price_egp === null)
    ? null
    : status.services.reduce((a, s) => a + (s.price_egp ?? 0), 0);

  if (status.status in ENDED) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Ticket number={status.ticket_no} className="opacity-60" />
        <Notice>{ENDED[status.status]}</Notice>
      </div>
    );
  }

  const serving = status.status === "serving";

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* aria-live: screen readers announce position changes as the queue moves */}
      <div aria-live="polite" className="flex flex-col gap-5">
        <Ticket number={status.ticket_no} label={serving ? "دورك دلوقتي!" : "رقمك"}
          className={serving ? "bg-brand" : undefined} />
        {serving ? (
          <Notice>اتفضل عند {status.barber_name ?? "الحلاق"}.</Notice>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-col gap-1">
              <span className="text-sm text-ink-soft">قدامك</span>
              <span className="text-[28px] leading-tight font-bold">{formatPeople(status.ahead ?? 0)}</span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-sm text-ink-soft">الانتظار تقريباً</span>
              <span className="text-[28px] leading-tight font-bold">{formatMinutes(status.estimated_minutes ?? 0)}</span>
            </Card>
          </div>
        )}
      </div>

      {!serving && status.wants_alert && (
        <Notice tone="warn">هنبعتلك واتساب لما يفضل قدامك {formatPeople(2)}. تقدر تخرج وترجع.</Notice>
      )}

      <Card className="flex flex-col gap-2">
        <span className="text-sm text-ink-soft">طلبك{status.barber_name && !serving ? ` · مع ${status.barber_name}` : ""}</span>
        {status.services.map((s) => (
          <div key={s.name} className="flex justify-between text-[15px]">
            <span>{s.name}</span>
            <span>{formatEGP(s.price_egp)}</span>
          </div>
        ))}
        {status.services.length > 1 && (
          <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold">
            <span>الإجمالي</span>
            <span>{formatEGP(total)}</span>
          </div>
        )}
      </Card>

      {error && <Notice tone="error">{error}</Notice>}

      {!serving &&
        (confirming ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border-[1.5px] border-danger bg-danger-tint p-4">
            <p className="text-[15px] font-medium">متأكد إنك عايز تخرج من الدور؟ هتخسر رقم {status.ticket_no}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>لأ، خليني</Button>
              <Button className="bg-danger hover:bg-danger"
                onClick={async () => {
                  try { await onLeave(); } catch (e) { setError(errorMessage(e)); setConfirming(false); }
                }}>
                أيوه، اخرج
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>اخرج من الدور</Button>
        ))}
    </div>
  );
}
