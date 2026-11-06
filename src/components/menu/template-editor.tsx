"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  FREE_TEXTS,
  MEAL_LABELS,
  sameTemplateSlot,
  WEEKDAY_NAMES,
  type FreeText,
  type Meal,
  type TemplateEntry,
} from "@/lib/domain/menu";

interface Option {
  id: string;
  title: string;
}

/** Valor del selector "qué": "t:Pedir a domicilio" o "r:<recipeId>". */
const encode = (e: Pick<TemplateEntry, "recipeId" | "text">) => (e.text ? `t:${e.text}` : `r:${e.recipeId}`);
function decode(v: string): Pick<TemplateEntry, "recipeId" | "text"> {
  return v.startsWith("t:") ? { recipeId: null, text: v.slice(2) as FreeText } : { recipeId: v.slice(2), text: null };
}

/**
 * Plantilla semanal: lo que se repite cada semana (viernes cena → Pizza,
 * sábado cena → Pedir a domicilio…). Se aplica al generar el menú.
 */
export function TemplateEditor({
  value,
  meals,
  library,
  onChange,
}: {
  value: TemplateEntry[];
  /** Comidas que se planifican (solo esas se ofrecen). */
  meals: Meal[];
  library: Option[];
  onChange: (next: TemplateEntry[]) => void;
}) {
  const [day, setDay] = useState(4); // viernes
  const [meal, setMeal] = useState<Meal>(meals.includes("cena") ? "cena" : meals[0]);
  const [what, setWhat] = useState("");

  const titles = new Map(library.map((r) => [r.id, r.title]));
  const sorted = [...value].sort((a, b) => a.day - b.day || (a.meal === b.meal ? 0 : a.meal === "comida" ? -1 : 1));
  const selectCls = "h-9 min-w-0 rounded-lg bg-fill px-2 text-[15px] outline-none";

  function add() {
    if (!what || !meals.includes(meal)) return;
    const entry: TemplateEntry = { day, meal, ...decode(what) };
    // Un hueco solo puede tener una entrada: la nueva sustituye a la anterior
    onChange([...value.filter((e) => !sameTemplateSlot(e, entry)), entry]);
    setWhat("");
  }

  return (
    <div className="px-4 py-3">
      <p className="text-[17px]">Plantilla semanal</p>
      <p className="mt-0.5 text-[13px] leading-snug text-muted">
        Lo que hacéis siempre. Al generar el menú, esos huecos salen ya puestos y bloqueados; el resto se equilibra contando con ellos.
      </p>

      {sorted.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-xl bg-fill/60">
          {sorted.map((e) => {
            const label = e.text ?? titles.get(e.recipeId!) ?? "Receta borrada";
            const off = !meals.includes(e.meal) || (e.recipeId !== null && !titles.has(e.recipeId));
            return (
              <li key={`${e.day}-${e.meal}`} className="flex min-h-11 items-center gap-2 px-3 py-1.5">
                <span className={off ? "flex-1 text-muted line-through" : "flex-1"}>
                  <span className="text-[13px] text-muted">
                    {WEEKDAY_NAMES[e.day]} · {MEAL_LABELS[e.meal]}
                  </span>
                  <span className="block text-[16px] leading-tight">{label}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${WEEKDAY_NAMES[e.day]} ${MEAL_LABELS[e.meal].toLowerCase()} de la plantilla`}
                  onClick={() => onChange(value.filter((o) => !sameTemplateSlot(o, e)))}
                  className="tap grid size-7 shrink-0 place-items-center rounded-full bg-terra-soft text-terra"
                >
                  <Minus className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <select aria-label="Día de la plantilla" value={day} onChange={(e) => setDay(Number(e.target.value))} className={selectCls}>
          {WEEKDAY_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Comida de la plantilla" value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className={selectCls}>
          {meals.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
        <select aria-label="Qué se come" value={what} onChange={(e) => setWhat(e.target.value)} className={`${selectCls} col-span-2`}>
          <option value="">Elige qué…</option>
          <optgroup label="Sin cocinar">
            {FREE_TEXTS.map((t) => (
              <option key={t} value={encode({ text: t, recipeId: null })}>
                {t}
              </option>
            ))}
          </optgroup>
          <optgroup label="Mis recetas">
            {library.map((r) => (
              <option key={r.id} value={`r:${r.id}`}>
                {r.title}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={!what}
        className="tap mt-2 flex h-9 items-center gap-1.5 text-[16px] font-semibold text-accent disabled:opacity-40"
      >
        <Plus className="size-4" />
        Añadir a la plantilla
      </button>
    </div>
  );
}
