"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { MEAL_LABELS, MEALS, type Meal, type PlanParams } from "@/lib/domain/menu";

const TIME_OPTIONS: (number | null)[] = [20, 30, 45, 60, 90, null];
const timeLabel = (m: number | null) => (m === null ? "Sin límite" : `Hasta ${m} min`);

/** Resumen corto de los parámetros: "2 personas · comida y cena · ≤45 min". */
export function paramsSummary(p: PlanParams): string {
  const parts = [
    `${p.people} ${p.people === 1 ? "persona" : "personas"}`,
    p.meals.length === 2 ? "comida y cena" : `solo ${MEAL_LABELS[p.meals[0]].toLowerCase()}`,
  ];
  if (p.maxMinutesWeekday) parts.push(`≤${p.maxMinutesWeekday} min entre semana`);
  if (p.vegetarian) parts.push("vegetariano");
  if (p.budget === "economico") parts.push("económico");
  return parts.join(" · ");
}

export function ParamsSheet({
  open,
  onClose,
  initial,
  hasPlan,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial: PlanParams;
  hasPlan: boolean;
  pending: boolean;
  onSubmit: (params: PlanParams) => void;
}) {
  const [p, setP] = useState(initial);
  const [avoidDraft, setAvoidDraft] = useState("");
  const set = <K extends keyof PlanParams>(k: K, v: PlanParams[K]) => setP((prev) => ({ ...prev, [k]: v }));

  function toggleMeal(meal: Meal) {
    const next = p.meals.includes(meal) ? p.meals.filter((m) => m !== meal) : MEALS.filter((m) => m === meal || p.meals.includes(m));
    if (next.length) set("meals", next);
  }

  function addAvoid() {
    const v = avoidDraft.trim().toLowerCase();
    if (v && !p.avoid.includes(v)) set("avoid", [...p.avoid, v]);
    setAvoidDraft("");
  }

  const row = "flex min-h-12 items-center justify-between gap-3 px-4 py-2";

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-canvas pb-4">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-canvas/95 px-4 pt-4 pb-2 backdrop-blur">
          <h2 className="text-[20px] font-bold">Ajustes del menú</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="tap grid size-8 place-items-center rounded-full bg-fill">
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-3 divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
          <div className={row}>
            <span className="text-[17px]">Personas</span>
            <Stepper value={p.people} onChange={(v) => set("people", v)} min={1} max={20} label="Personas" />
          </div>
          <div className={row}>
            <span className="text-[17px]">Planificar</span>
            <div className="flex gap-2">
              {MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={p.meals.includes(m)}
                  onClick={() => toggleMeal(m)}
                  className={cn(
                    "tap h-8 rounded-full px-3.5 text-[14px] font-medium",
                    p.meals.includes(m) ? "bg-accent text-accent-ink" : "bg-fill text-muted",
                  )}
                >
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <TimeRow label="Entre semana" value={p.maxMinutesWeekday} onChange={(v) => set("maxMinutesWeekday", v)} />
          <TimeRow label="Fin de semana" value={p.maxMinutesWeekend} onChange={(v) => set("maxMinutesWeekend", v)} />
        </div>

        <div className="mx-3 mt-4 divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
          <div className="px-4 py-3">
            <p className="mb-2 text-[17px]">Presupuesto</p>
            <Segmented
              label="Presupuesto"
              value={p.budget}
              onChange={(v) => set("budget", v)}
              options={[
                { value: "normal", label: "Normal" },
                { value: "economico", label: "Económico" },
              ]}
            />
          </div>
          <div className={row}>
            <span className="text-[17px]">Vegetariano</span>
            <Switch checked={p.vegetarian} onChange={(v) => set("vegetarian", v)} label="Vegetariano" />
          </div>
          <div className="px-4 py-3">
            <p className="text-[17px]">Evitar ingredientes</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {p.avoid.map((a) => (
                <span key={a} className="flex h-8 items-center gap-1 rounded-full bg-terra-soft pr-1.5 pl-3 text-[14px]">
                  {a}
                  <button type="button" aria-label={`No evitar ${a}`} onClick={() => set("avoid", p.avoid.filter((x) => x !== a))} className="tap grid size-5 place-items-center">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                value={avoidDraft}
                onChange={(e) => setAvoidDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAvoid();
                  }
                }}
                onBlur={addAvoid}
                placeholder="Cerdo, marisco…"
                aria-label="Ingrediente a evitar"
                className="h-8 min-w-28 flex-1 bg-transparent outline-none placeholder:text-muted/70"
              />
            </div>
          </div>
        </div>

        <p className="mx-6 mt-3 text-[13px] text-muted">
          El presupuesto, de momento, favorece legumbres, huevos, pasta y verdura. Con la lista de la compra llegarán los precios.
        </p>

        <div className="mx-3 mt-4">
          <Button size="lg" disabled={pending} onClick={() => onSubmit(p)}>
            {pending ? "Generando…" : hasPlan ? "Guardar y regenerar" : "Generar menú"}
          </Button>
          {hasPlan && <p className="mt-2 text-center text-[13px] text-muted">Los platos bloqueados se mantienen.</p>}
        </div>
      </div>
    </Sheet>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[17px]">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={`Tiempo máximo ${label.toLowerCase()}`}
        className="bg-transparent text-right text-muted outline-none"
      >
        {TIME_OPTIONS.map((m) => (
          <option key={m ?? "none"} value={m ?? ""}>
            {timeLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
