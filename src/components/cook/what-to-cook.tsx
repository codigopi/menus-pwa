"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Recycle, Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { IdeaGenerator } from "@/components/taste/idea-generator";
import { usePersistentList } from "@/lib/hooks/use-persistent-list";
import {
  COMMON_INGREDIENTS,
  DEFAULT_STAPLES,
  fold,
  heads,
  ingredientMatches,
  matchRecipes,
  type MatchableRecipe,
  type RecipeMatch,
} from "@/lib/domain/matching";
import type { RecipeSummary } from "@/lib/domain/recipe";

type Recipe = RecipeSummary & MatchableRecipe;

const EMPTY: string[] = [];
const MAX_SUGGESTIONS = 8;

/** Primera letra en mayúscula para mostrar. */
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "¿Qué cocino?": eliges lo que tienes y se buscan recetas de tu biblioteca,
 * indicando qué usas y qué te falta. Todo se calcula en el móvil, al instante.
 */
export function WhatToCook({ recipes, aiEnabled, pantry = [] }: { recipes: Recipe[]; aiEnabled: boolean; pantry?: string[] }) {
  const [have, setHave] = usePersistentList("cec:tengo", EMPTY);
  const [staples, setStaples] = usePersistentList("cec:basicos", DEFAULT_STAPLES);
  const [draft, setDraft] = useState("");
  const [showMore, setShowMore] = useState(false);

  // Nombres de ingredientes de la biblioteca, por frecuencia, para sugerir.
  const libraryNames = useMemo(() => {
    const count = new Map<string, { name: string; n: number }>();
    for (const r of recipes) {
      for (const ing of r.ingredients) {
        const key = heads(ing.name).join("|");
        if (!key) continue;
        const entry = count.get(key) ?? { name: ing.name.toLowerCase(), n: 0 };
        entry.n++;
        // Preferimos la forma más corta como etiqueta ("tomate" mejor que "tomate triturado")
        if (ing.name.length < entry.name.length) entry.name = ing.name.toLowerCase();
        count.set(key, entry);
      }
    }
    return [...count.values()].sort((a, b) => b.n - a.n).map((e) => e.name);
  }, [recipes]);

  const alreadyHave = (name: string) => have.some((h) => ingredientMatches(h, name)) || staples.some((s) => ingredientMatches(s, name));

  const suggestions = useMemo(() => {
    const q = fold(draft.trim());
    const pool = [...libraryNames, ...COMMON_INGREDIENTS];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of pool) {
      const key = heads(name).join("|");
      if (seen.has(key) || alreadyHave(name)) continue;
      if (q && !fold(name).includes(q)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alreadyHave depende de have/staples
  }, [draft, libraryNames, have, staples]);

  function add(name: string) {
    const clean = name.trim().toLowerCase();
    if (!clean) return;
    if (!have.some((h) => heads(h).join("|") === heads(clean).join("|"))) setHave([...have, clean]);
    setDraft("");
  }

  const matches = useMemo(() => matchRecipes(recipes, have, staples), [recipes, have, staples]);
  const ready = matches.filter((m) => m.missing.length === 0);
  const almost = matches.filter((m) => m.missing.length > 0 && m.missing.length <= 2);
  const more = matches.filter((m) => m.missing.length > 2);
  // Si no hay nada mejor, no escondemos las ideas con más faltas.
  const expandMore = showMore || ready.length + almost.length === 0;

  return (
    <div>
      {/* Lo que tengo */}
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-[15px] font-semibold">Tengo…</h2>

        {have.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {have.map((h) => (
              <span key={h} className="flex h-8 items-center gap-1 rounded-full bg-accent pr-1.5 pl-3 text-[14px] font-medium text-accent-ink">
                {label(h)}
                <button type="button" aria-label={`Quitar ${h}`} onClick={() => setHave(have.filter((x) => x !== h))} className="tap grid size-5 place-items-center rounded-full">
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => setHave([])} className="tap h-8 px-2 text-[14px] text-muted">
              Borrar todo
            </button>
          </div>
        )}

        {/* Lo que hay en la despensa (pestaña Compra), sin reescribirlo */}
        {(() => {
          const fromPantry = pantry.filter((p) => !have.some((h) => ingredientMatches(h, p)) && !staples.some((st) => ingredientMatches(st, p)));
          return fromPantry.length > 0 ? (
            <button
              type="button"
              onClick={() => setHave([...have, ...fromPantry.map((p) => p.toLowerCase())])}
              className="tap mb-3 flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[14px] font-medium text-accent"
            >
              <Plus className="size-4" /> Añadir lo de mi despensa ({fromPantry.length})
            </button>
          ) : null;
        })()}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
          className="flex h-11 items-center gap-2 rounded-xl bg-fill px-3"
        >
          <Search className="size-[18px] shrink-0 text-muted" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={have.length ? "Añadir otro ingrediente…" : "Huevos, calabacín, arroz…"}
            aria-label="Añadir ingrediente que tengo"
            enterKeyHint="done"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
          />
          {draft.trim() && (
            <button type="submit" className="tap text-[15px] font-semibold text-accent">
              Añadir
            </button>
          )}
        </form>

        {suggestions.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="tap flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3 text-[14px] whitespace-nowrap"
              >
                <Plus className="size-3.5 text-accent" /> {label(s)}
              </button>
            ))}
          </div>
        )}

        <StaplesEditor staples={staples} onChange={setStaples} />
      </section>

      {/* Resultados */}
      {recipes.length === 0 ? (
        <Hint>
          Aún no tienes recetas guardadas. <Link href="/importar" className="font-medium text-accent">Importa</Link> o{" "}
          <Link href="/recetas/nueva" className="font-medium text-accent">escribe</Link> algunas y aquí te diré cuáles puedes cocinar.
        </Hint>
      ) : have.length === 0 ? (
        <Hint>Añade lo que tienes en la nevera y la despensa y te diré qué puedes cocinar con tus recetas.</Hint>
      ) : matches.length === 0 ? (
        <Hint>Ninguna de tus recetas usa esos ingredientes. Prueba a añadir alguno más.</Hint>
      ) : (
        <>
          <ResultGroup title="Puedes hacerlas ya" icon={<Check className="size-4" />} items={ready} />
          <ResultGroup title="Te falta poco" items={almost} />
          {more.length > 0 &&
            (expandMore ? (
              <ResultGroup title={ready.length + almost.length ? "Otras ideas" : "Te faltan varias cosas"} items={more} />
            ) : (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="tap mt-6 flex w-full items-center justify-center gap-1.5 text-[15px] font-medium text-accent"
              >
                Ver {more.length} {more.length === 1 ? "idea más" : "ideas más"} (faltan más cosas) <ChevronDown className="size-4" />
              </button>
            ))}
        </>
      )}

      {/* Recetas nuevas inventadas con IA a partir de lo que hay */}
      <IdeaGenerator
        aiEnabled={aiEnabled}
        mode="ingredientes"
        ingredients={have}
        staples={staples}
        title="Recetas nuevas con lo que tienes"
        subtitle={have.length ? `Ideas caseras inventadas con ${have.join(", ")}, priorizando el aprovechamiento.` : "Añade arriba lo que tienes y te propongo recetas nuevas de aprovechamiento."}
      />
    </div>
  );
}

function StaplesEditor({ staples, onChange }: { staples: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <details className="group mt-4 border-t border-hairline pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[14px] text-muted [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">
          Siempre tengo: <span className="text-ink">{staples.length ? staples.join(", ") : "nada"}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-[13px] text-muted">Estos básicos no cuentan como «te falta».</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {staples.map((s) => (
          <span key={s} className="flex h-7 items-center gap-1 rounded-full bg-fill pr-1 pl-2.5 text-[13px]">
            {label(s)}
            <button type="button" aria-label={`Quitar ${s}`} onClick={() => onChange(staples.filter((x) => x !== s))} className="tap grid size-5 place-items-center">
              <X className="size-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!staples.includes(draft.trim().toLowerCase())) onChange([...staples, draft.trim().toLowerCase()]);
              setDraft("");
            }
          }}
          placeholder="Añadir básico…"
          aria-label="Añadir básico"
          className="h-7 min-w-24 flex-1 bg-transparent text-[13px]! outline-none placeholder:text-muted/70"
        />
      </div>
    </details>
  );
}

function ResultGroup({ title, icon, items }: { title: string; icon?: ReactNode; items: RecipeMatch<Recipe>[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">
        {icon} {title} <span className="font-normal">· {items.length}</span>
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
        {items.map((m) => (
          <li key={m.recipe.id}>
            <MatchRow match={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchRow({ match: { recipe, used, missing, missingMinor } }: { match: RecipeMatch<Recipe> }) {
  return (
    <Link href={`/recetas/${recipe.id}`} className="flex gap-3 px-4 py-3 transition-colors active:bg-fill">
      <RecipePhoto photo={recipe.photo} title={recipe.title} className="size-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[16px] leading-snug font-semibold">
          <span className="truncate">{recipe.title}</span>
          {recipe.tags.includes("aprovechamiento") && <Recycle className="size-3.5 shrink-0 text-accent" aria-label="Aprovechamiento" />}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-accent">Usas: {used.join(", ")}</p>
        {missing.length > 0 ? (
          <p className="text-[13px] leading-snug text-terra">Te falta: {missing.join(", ")}</p>
        ) : (
          <p className={cn("text-[13px] leading-snug text-muted")}>¡Tienes todo lo principal!</p>
        )}
        {missingMinor.length > 0 && <p className="text-[12px] text-muted">Al gusto u opcional: {missingMinor.join(", ")}</p>}
      </div>
    </Link>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-8 px-4 text-center text-[15px] leading-snug text-muted">{children}</p>;
}
