import type { ReactNode } from "react";
import { cn } from "./cn";

const TONES = {
  info: "border-line bg-surface text-ink",
  warn: "border-warn-line bg-warn-tint text-warn",
  error: "border-danger bg-danger-tint text-danger",
} as const;

/** Inline message. Errors use role="alert" so screen readers announce them immediately. */
export function Notice({ tone = "info", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[var(--radius-card)] border-[1.5px] px-4 py-3.5 text-[15px] leading-relaxed", TONES[tone])}
    >
      {children}
    </div>
  );
}
