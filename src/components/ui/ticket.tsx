import { cn } from "./cn";

/** The big ticket number ("رقمك 14"), shared by the customer page, counter and TV. */
export function Ticket({ number, label = "رقمك", className }: { number: number; label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 rounded-[20px] bg-ink px-5 py-7 text-paper", className)}>
      <span className="text-[15px] text-[#c9cdd2]">{label}</span>
      <span className="text-[88px] leading-none font-bold tabular-nums">{number}</span>
    </div>
  );
}
