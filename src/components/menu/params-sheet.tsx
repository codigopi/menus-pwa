"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { familyLabel, MEAL_LABELS, MEALS, type Meal, type PlanParams } from "@/lib/domain/menu";
import { TemplateEditor } from "./template-editor";

const TIME_OPTIONS: (number | null)[] = [20, 30, 45, 60, 90, null];
const timeLabel = (m: number | null) => (m === null ? "Sin límite" : `Hasta ${m} min`);

/** "comida (1º y 2º) y cena", "solo cena"… */
function mealsSummary(p: PlanParams): string {
  const lunch = p.lunchCourses === "dos" ? "comida (1º y 2º)" : "comida";
  if (p.meals.length === 2) return `${lunch} y cena`;
  return p.meals[0] === "comida" ? `solo ${lunch}` : `solo ${MEAL_LABELS[p.meals[0]].toLowerCase()}`;
}

/** Resumen corto de los parámetros: "2 personas · comida (1º y 2º) y cena · ≤45 min". */
export function paramsSummary(p: PlanParams): string {
  const parts = [
    familyLabel(p),
    mealsSummary(p),
  ];
  if (p.maxMinutesWeekday) parts.push(`≤${p.maxMinutesWeekday} min entre semana`);
  if (p.vegetarian) parts.push("vegetariano");
  if (p.budget === "economico") parts.push("económico");
  if (p.template.length) parts.push(`plantilla (${p.template.length})`);
  return parts.join(" · ");
}

export function ParamsSheet({
  open,
  onClose,
  initial,
  hasPlan,
  library,
  pending,
  onSubmit,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: PlanParams;
  hasPlan: boolean;
  /** Recetas para elegir en la plantilla semanal. */
  library: { id: string; title: string }[];
  pending: boolean;
  /** Generar/regenerar con estos ajustes (también los guarda). */
  onSubmit: (params: PlanParams) => void;
  /** Guardar sin regenerar (al cerrar la hoja con cambios). */
  onSave: (params: PlanParams) => void;
}) {
  const [p, setP] = useState(initial);
  const [avoidDraft, setAvoidDraft] = useState("");

  /** Cerrar = guardar (como en los Ajustes de iOS). Incluye lo escrito en "evitar". */
  function close() {
    const pendingAvoid = avoidDraft.trim().toLowerCase();
    const final = pendingAvoid && !p.avoid.includes(pendingAvoid) ? { ...p, avoid: [...p.avoid, pendingAvoid] } : p;
    if (JSON.stringify(final) !== JSON.stringify(initial)) onSave(final);
    onClose();
  }
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
    <Sheet open={open} onClose={close}>
      <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-canvas pb-4">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-canvas/95 px-4 pt-4 pb-2 backdrop-blur">
          <h2 className="text-[20px] font-bold">Ajustes del menú</h2>
          <button type="button" onClick={close} className="tap px-1 text-[17px] font-semibold text-accent">
            Listo
          </button>
        </div>

        <div className="mx-3 divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
          <div className={row}>
            <span className="text-[17px]">Adultos</span>
            <Stepper value={p.adults} onChange={(v) => set("adults", v)} min={1} max={12} label="Adultos" />
          </div>
          <div className={row}>
            <span className="text-[17px]">
              Niños
              <span className="block text-[12px] text-muted">Ración algo menor · sin pescados con mercurio</span>
            </span>
            <Stepper value={p.children} onChange={(v) => set("children", v)} min={0} max={12} label="Niños" />
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
          {p.meals.includes("comida") && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[17px]">Comida</p>
              <Segmented
                label="Platos de la comida"
                value={p.lunchCourses}
                onChange={(v) => set("lunchCourses", v)}
                options={[
                  { value: "dos", label: "Primero y segundo" },
                  { value: "unico", label: "Plato único" },
                ]}
              />
              <p className="mt-2 text-[13px] leading-snug text-muted">Cualquier día suelto puedes cambiarlo desde el propio plato del menú.</p>
            </div>
          )}
          <TimeRow label="Entre semana" value={p.maxMinutesWeekday} onChange={(v) => set("maxMinutesWeekday", v)} />
          <TimeRow label="Fin de semana" value={p.maxMinutesWeekend} onChange={(v) => set("maxMinutesWeekend", v)} />
        </div>

        <div className="mx-3 mt-4 overflow-hidden rounded-2xl bg-card">
          <TemplateEditor value={p.template} meals={p.meals} library={library} onChange={(v) => set("template", v)} />
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
          «Económico» prioriza los platos más baratos por ración, según precios orientativos de supermercado.
        </p>

        <div className="mx-3 mt-4">
          <Button size="lg" disabled={pending} onClick={() => onSubmit(p)}>
            {pending ? "Generando…" : hasPlan ? "Regenerar con estos ajustes" : "Generar menú"}
          </Button>
          <p className="mt-2 text-center text-[13px] leading-snug text-muted">
            {hasPlan
              ? "Los ajustes se guardan al cerrar. Al regenerar, los platos bloqueados se mantienen."
              : "Los ajustes se guardan al cerrar y se usarán en las próximas semanas."}
          </p>
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
