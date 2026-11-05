"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart, Trash2 } from "lucide-react";
import { deleteRecipeAction, rateRecipe, toggleFavorite } from "@/app/(app)/recetas/actions";
import { cn } from "@/components/ui/cn";
import { Sheet } from "@/components/ui/sheet";
import { StarRating } from "@/components/ui/star-rating";

/** Corazón de favorita con actualización optimista (respuesta inmediata). */
export function FavoriteButton({ id, isFavorite }: { id: string; isFavorite: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? "Quitar de favoritas" : "Marcar como favorita"}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleFavorite(id, !optimistic);
        })
      }
      className="tap grid size-9 place-items-center"
    >
      <Heart className={cn("size-6 transition-colors", optimistic ? "fill-terra text-terra" : "text-accent")} />
    </button>
  );
}

/** Estrellas interactivas con actualización optimista. */
export function RatingControl({ id, rating }: { id: string; rating: number | null }) {
  const [optimistic, setOptimistic] = useOptimistic(rating);
  const [, startTransition] = useTransition();
  return (
    <StarRating
      value={optimistic}
      size="lg"
      onChange={(value) =>
        startTransition(async () => {
          setOptimistic(value);
          await rateRecipe(id, value);
        })
      }
    />
  );
}

/** Botón de borrar con hoja de confirmación estilo iOS. */
export function DeleteRecipeButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-card text-[17px] text-danger"
      >
        <Trash2 className="size-5" /> Eliminar receta
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="mb-2 overflow-hidden rounded-2xl bg-card/95 text-center backdrop-blur-xl">
          <p className="px-6 pt-4 pb-3 text-[13px] text-muted">
            Se eliminará «{title}» y su foto. Esta acción no se puede deshacer.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteRecipeAction(id))}
            className="h-14 w-full border-t border-hairline text-[20px] text-danger disabled:opacity-50"
          >
            {pending ? "Eliminando…" : "Eliminar receta"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-14 w-full rounded-2xl bg-card text-[20px] font-semibold text-accent"
        >
          Cancelar
        </button>
      </Sheet>
    </>
  );
}
