import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/** Toggle pill (services, barber choice). aria-pressed tells screen readers it is on. */
export function Chip({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-11 cursor-pointer rounded-full border-[1.5px] px-3.5 text-[15px] transition-colors",
        selected ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:border-ink",
        className,
      )}
      {...props}
    />
  );
}
