import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-sunken disabled:text-ink-soft",
  secondary: "bg-surface text-ink border-[1.5px] border-line-strong hover:border-ink",
  outline: "bg-surface text-brand border-[1.5px] border-brand hover:bg-brand-tint",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-transparent text-danger hover:bg-danger-tint",
} as const;

// Every size is a comfortable touch target (>= 44px).
const SIZES = {
  md: "min-h-11 px-4 text-[15px]",
  lg: "min-h-13 px-5 text-base",
  xl: "min-h-16 px-6 text-xl",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "lg",
  block,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] font-bold transition-colors",
        "cursor-pointer disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
