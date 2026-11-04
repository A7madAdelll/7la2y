"use client";

import { useEffect, useState } from "react";

/**
 * The rotating shop code with a countdown. Tapping it opens the code full screen, so a barber
 * working from his own phone can turn it toward the customer.
 */
export function PresenceCode({ code, expiresAt, onExpire }: { code: string; expiresAt: string; onExpire?: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) onExpire?.();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpire]);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big]);
  const mm = left === null ? "–" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <>
      <button type="button" onClick={() => setBig(true)} aria-label={`كود الدخول ${code}، اعرضه بالشاشة كلها`}
        className="flex min-h-11 cursor-pointer items-center gap-3.5 rounded-[14px] bg-ink-raised px-4 py-2 text-paper hover:bg-[#2e3d4b]">
        <span className="text-sm text-[#c9cdd2]">كود الدخول</span>
        <span dir="ltr" className="text-[34px] font-bold tracking-[6px] tabular-nums">{code}</span>
        <span className="text-[13px] text-[#c9cdd2]">يتغير بعد <span dir="ltr" className="tabular-nums">{mm}</span></span>
      </button>
      {big && (
        <div role="dialog" aria-modal="true" aria-label="كود الدخول"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink p-6 text-center text-paper"
          onClick={() => setBig(false)}>
          <span className="text-2xl text-[#c9cdd2]">كود الدخول</span>
          <span dir="ltr" className="text-[min(28vw,180px)] leading-none font-bold tracking-[0.12em] tabular-nums">{code}</span>
          <span className="text-xl text-[#c9cdd2]">يتغير بعد <span dir="ltr" className="tabular-nums">{mm}</span></span>
          <button type="button" autoFocus onClick={() => setBig(false)}
            className="mt-4 min-h-13 cursor-pointer rounded-[14px] border-[1.5px] border-[#4a535c] px-8 text-lg font-bold">
            رجوع
          </button>
        </div>
      )}
    </>
  );
}
