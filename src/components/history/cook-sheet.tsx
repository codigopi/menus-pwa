"use client";

import { useState, useTransition } from "react";
import { logCooked } from "@/app/(app)/historico/actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { StarRating } from "@/components/ui/star-rating";
import type { Meal } from "@/lib/domain/menu";

/** Fecha local de hoy "YYYY-MM-DD" (en el navegador). */
export const localToday = () => new Date().toLocaleDateString("en-CA");

/**
 * Hoja "Lo he cocinado": fecha, valoración y notas para la próxima vez.
 * Se usa desde la receta y desde el menú.
 */
export function CookSheet({
  recipe,
  defaultDate,
  meal = null,
  slotId = null,
  onClose,
  onDone,
}: {
  recipe: { id: string; title: string };
  defaultDate?: string;
  meal?: Meal | null;
  slotId?: string | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const today = localToday();
  // Un plato del menú de un día futuro se marca, como mucho, con fecha de hoy
  const [date, setDate] = useState(defaultDate && defaultDate <= today ? defaultDate : today);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await logCooked({ recipeId: recipe.id, cookedOn: date, meal, slotId, rating, notes: notes.trim() || null });
      if (res.error) setError(res.error);
      else {
        onDone?.();
        onClose();
      }
    });
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="rounded-2xl bg-canvas p-4 pb-5">
        <p className="text-[13px] text-muted">Lo he cocinado</p>
        <h2 className="mb-4 text-[20px] leading-tight font-bold">{recipe.title}</h2>

        <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
          <label className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[17px]">Fecha</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-right text-muted outline-none"
            />
          </label>
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[17px]">¿Qué tal salió?</span>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div className="px-4 py-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Notas para la próxima vez: «menos sal», «mejor con nata»…"
              aria-label="Notas"
              className="w-full resize-none bg-transparent leading-snug outline-none placeholder:text-muted/70"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
