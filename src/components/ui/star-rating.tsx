"use client";

import { Star } from "lucide-react";
import { cn } from "./cn";

/**
 * Valoración de 1 a 5 estrellas. Si recibe onChange es interactiva:
 * tocar la estrella ya seleccionada borra la valoración.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: "sm" | "md" | "lg";
}) {
  const px = { sm: "size-3.5", md: "size-5", lg: "size-7" }[size];
  const stars = [1, 2, 3, 4, 5];
  const starClass = (n: number) => cn(px, value && n <= value ? "fill-star text-star" : "text-fill-strong");

  if (!onChange) {
    return (
      <span className="inline-flex gap-0.5" aria-label={value ? `${value} de 5 estrellas` : "Sin valorar"}>
        {stars.map((n) => (
          <Star key={n} className={starClass(n)} />
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex gap-1" role="radiogroup" aria-label="Valoración">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
          onClick={() => onChange(value === n ? null : n)}
          className="tap p-0.5"
        >
          <Star className={starClass(n)} />
        </button>
      ))}
    </span>
  );
}
