"use client";

import { useState } from "react";
import { Apple, Check, ChevronDown, TriangleAlert } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { RuleStatus } from "@/lib/domain/nutrition";

const target = (r: RuleStatus) => {
  if (r.id === "verdura_diaria") return `${r.count} de ${r.min} días`;
  if (r.min !== undefined && r.max !== undefined) return `${r.count} · objetivo ${r.min === r.max ? r.min : `${r.min}–${r.max}`}`;
  if (r.max !== undefined) return `${r.count} · máx. ${r.max}`;
  if (r.min !== undefined) return `${r.count} · mín. ${r.min}`;
  return String(r.count);
};

/**
 * Equilibrio nutricional de la semana frente a la pirámide (AESAN/SENC).
 * Plegada muestra el resumen; desplegada, cada recomendación.
 */
export function NutritionCard({ rules }: { rules: RuleStatus[] }) {
  const issues = rules.filter((r) => r.status !== "ok");
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-4 overflow-hidden rounded-2xl bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", issues.length ? "bg-terra-soft text-terra" : "bg-accent-soft text-accent")}>
          {issues.length ? <TriangleAlert className="size-4" /> : <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Equilibrio nutricional</span>
          <span className="block text-[13px] text-muted">
            {issues.length === 0
              ? "La semana cumple las recomendaciones"
              : `${rules.length - issues.length} de ${rules.length} recomendaciones · revisa ${issues.length === 1 ? "1 punto" : `${issues.length} puntos`}`}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {/* Consejos siempre visibles si algo no cumple */}
      {issues.length > 0 && !open && (
        <ul className="space-y-1 border-t border-hairline px-4 py-3 text-[13px] leading-snug">
          {issues.slice(0, 3).map((r) => (
            <li key={r.id} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terra" />
              {r.advice}
            </li>
          ))}
          {issues.length > 3 && <li className="text-muted">y {issues.length - 3} más…</li>}
        </ul>
      )}

      {open && (
        <div className="border-t border-hairline">
          <ul className="divide-y divide-hairline">
            {rules.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {r.status === "ok" ? (
                    <Check className="size-4 shrink-0 text-accent" strokeWidth={3} />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0 text-terra" />
                  )}
                  <span className="flex-1 text-[15px]">{r.label}</span>
                  <span className="text-[13px] text-muted tabular-nums">{target(r)}</span>
                </div>
                {r.advice && <p className="mt-1 ml-6.5 text-[13px] leading-snug text-muted">{r.advice}</p>}
              </li>
            ))}
          </ul>
          <p className="flex gap-2 bg-fill/60 px-4 py-3 text-[13px] leading-snug text-muted">
            <Apple className="mt-0.5 size-4 shrink-0" />
            Cada día: fruta de postre (3 piezas al día), lácteos 2–3 raciones, pan y cereales mejor integrales, y agua para beber.
            Recomendaciones AESAN/SENC, orientativas.
          </p>
        </div>
      )}
    </section>
  );
}
