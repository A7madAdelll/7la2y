import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Label + input + hint/error, wired with aria-describedby / aria-invalid. */
export function TextField({ label, hint, error, className, id, ...props }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[15px] font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? noteId : undefined}
        className={cn(
          "min-h-13 rounded-[var(--radius-control)] border-[1.5px] bg-surface px-3.5 text-[17px] text-ink",
          "placeholder:text-[#6b7178]",
          error ? "border-danger" : "border-line-strong",
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p id={noteId} className={cn("text-sm", error ? "text-danger" : "text-ink-soft")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
