"use client";

import { cn } from "./cn";

/** Interruptor estilo iOS. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-accent" : "bg-fill-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-200",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}
