"use client";

import { Minus, Plus } from "lucide-react";

/** Selector numérico − / + estilo iOS. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 50,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const btn = "tap grid h-8 w-11 place-items-center text-ink disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-6 text-right text-[17px] tabular-nums" aria-live="polite">
        {value}
      </span>
      <div className="flex items-center rounded-lg bg-fill" role="group" aria-label={label}>
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Menos">
          <Minus className="size-4" />
        </button>
        <span className="h-4 w-px bg-hairline" />
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Más">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
