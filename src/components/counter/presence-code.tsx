"use client";

import { useEffect, useState } from "react";

/** Shows the rotating shop code and a countdown; calls onExpire to fetch the next code. */
export function PresenceCode({ code, expiresAt, onExpire }: { code: string; expiresAt: string; onExpire?: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
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
  const mm = left === null ? "–" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] bg-ink-raised px-4 py-2">
      <span className="text-sm text-[#c9cdd2]">كود الدخول</span>
      <span dir="ltr" className="text-[34px] font-bold tracking-[6px] tabular-nums">{code}</span>
      <span className="text-[13px] text-[#c9cdd2]">يتغير بعد <span dir="ltr" className="tabular-nums">{mm}</span></span>
    </div>
  );
}
