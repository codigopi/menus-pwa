"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Clock, Heart, Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { StarRating } from "@/components/ui/star-rating";
import { formatMinutes, tagLabel, totalMinutes, type RecipeSummary } from "@/lib/domain/recipe";
import { RecipePhoto } from "./recipe-photo";

/** Quita tildes y pasa a minúsculas para buscar "lentejas" = "Léntejas". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FAVORITES = "__favoritas__";

/**
 * Biblioteca de recetas con búsqueda instantánea y filtro por etiquetas.
 * Se filtra en el cliente: una biblioteca doméstica cabe de sobra en memoria.
 */
export function RecipeLibrary({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  // Etiquetas ordenadas por frecuencia.
  const tags = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of recipes) for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [recipes]);

  const hasFavorites = recipes.some((r) => r.isFavorite);

  const filtered = useMemo(() => {
    const q = fold(deferredQuery.trim());
    return recipes.filter((r) => {
      if (tag === FAVORITES && !r.isFavorite) return false;
      if (tag && tag !== FAVORITES && !r.tags.includes(tag)) return false;
      if (!q) return true;
      return fold(r.title).includes(q) || r.tags.some((t) => fold(t).includes(q));
    });
  }, [recipes, deferredQuery, tag]);

  return (
    <div>
      {/* Buscador estilo iOS */}
      <label className="mb-3 flex h-10 items-center gap-2 rounded-xl bg-fill px-3 text-muted">
        <Search className="size-[18px] shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar recetas"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="tap">
            <X className="size-4 rounded-full bg-muted/50 p-0.5 text-canvas" strokeWidth={3} />
          </button>
        )}
      </label>

      {/* Filtros por etiqueta */}
      {(tags.length > 0 || hasFavorites) && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={tag === null} onClick={() => setTag(null)}>
            Todas
          </Chip>
          {hasFavorites && (
            <Chip active={tag === FAVORITES} onClick={() => setTag(tag === FAVORITES ? null : FAVORITES)}>
              <Heart className="size-3.5 fill-current" /> Favoritas
            </Chip>
          )}
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {tagLabel(t)}
            </Chip>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-muted">No hay recetas que coincidan.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((r, i) => (
            <li key={r.id}>
              <RecipeCard recipe={r} priority={i < 4} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap",
        active ? "bg-ink text-canvas" : "bg-card text-ink shadow-[0_0_0_0.5px_var(--hairline)]",
      )}
    >
      {children}
    </button>
  );
}

function RecipeCard({ recipe: r, priority }: { recipe: RecipeSummary; priority: boolean }) {
  const minutes = totalMinutes(r);
  return (
    <Link href={`/recetas/${r.id}`} className="tap block overflow-hidden rounded-2xl bg-card shadow-[0_1px_3px_rgb(0_0_0/0.06)]">
      <div className="relative">
        <RecipePhoto photo={r.photo} title={r.title} priority={priority} className="aspect-[4/3] w-full" />
        {r.isFavorite && (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/25 backdrop-blur-md">
            <Heart className="size-4 fill-white text-white" />
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{r.title}</h3>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted">
          {minutes !== null ? (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {formatMinutes(minutes)}
            </span>
          ) : (
            <span />
          )}
          {r.rating && <StarRating value={r.rating} size="sm" />}
        </div>
      </div>
    </Link>
  );
}
