"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

/** Control segmentado estilo iOS. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[10px] bg-fill p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[14px] font-medium transition-all",
              active ? "bg-card text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
