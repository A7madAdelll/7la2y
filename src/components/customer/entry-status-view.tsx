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
  /** Calls public.forget_me(token): erases name and phone from this shop. */
  onForget?: () => Promise<void>;
  /** "Confirm on WhatsApp": asks for a code and opens WhatsApp. Absent when WhatsApp is not set up. */
  onConfirmWhatsApp?: () => Promise<void>;
};

export function EntryStatusView({ status, onLeave, onForget, onConfirmWhatsApp }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = status.services.some((s) => s.price_egp === null)
    ? null
    : status.services.reduce((a, s) => a + (s.price_egp ?? 0), 0);

  // Lives here (not in ForgetMe) so the confirmation survives the switch to the "ended" layout.
  const [forgotten, setForgotten] = useState(false);
  const forget = forgotten ? (
    <Notice>اتمسح اسمك ورقمك من المحل ده.</Notice>
  ) : (
    onForget && <ForgetMe onForget={async () => { await onForget(); setForgotten(true); }} onError={setError} />
  );

  if (status.status in ENDED) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Ticket number={status.ticket_no} className="opacity-60" />
        <Notice>{ENDED[status.status]}</Notice>
        {error && <Notice tone="error">{error}</Notice>}
        {forget}
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
          <>
            <Notice>اتفضل عند {status.barber_name ?? "الحلاق"}.</Notice>
            {status.no_show_minutes ? (
              <Notice tone="warn">
                لو مش في المحل، ارجع خلال {formatMinutes(status.no_show_minutes)} وإلا ممكن دورك يروح.
              </Notice>
            ) : null}
          </>
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

      {status.whatsapp_confirmed ? (
        <Notice>اتأكد رقمك، وبعتنالك لينك دورك وطلبك على الواتساب.</Notice>
      ) : (
        onConfirmWhatsApp && !serving && (
          <Card className="flex flex-col gap-3">
            <span className="text-[15px] font-medium">عايز لينك دورك على الواتساب؟</span>
            <span className="text-sm text-ink-soft">ابعت رسالة واحدة جاهزة من رقمك، ونردّ عليك باللينك وطلبك عشان ترجعله في أي وقت.</span>
            <Button variant="outline" size="md"
              onClick={async () => { try { await onConfirmWhatsApp(); } catch (e) { setError(errorMessage(e)); } }}>
              أكّد على الواتساب
            </Button>
          </Card>
        )
      )}

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
      {forget}
    </div>
  );
}

/** PDPL: the customer can erase their name and number from this shop at any time. */
function ForgetMe({ onForget, onError }: { onForget: () => Promise<void>; onError: (m: string) => void }) {
  return (
    <button type="button" className="min-h-11 cursor-pointer text-sm text-ink-soft underline underline-offset-4"
      onClick={async () => {
        if (!confirm("هنمسح اسمك ورقمك من المحل ده، ولو لسه في الدور هتخرج منه. متأكد؟")) return;
        try { await onForget(); } catch (e) { onError(errorMessage(e)); }
      }}>
      امسح بياناتي
    </button>
  );
}
