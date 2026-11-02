import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface p-4", className)}
      {...props}
    />
  );
}
