"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChefHat, ChevronLeft, CircleSlash, Lock, LockOpen, Rows2, Search, Shuffle, Soup, Utensils } from "lucide-react";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { cn } from "@/components/ui/cn";
import { Sheet } from "@/components/ui/sheet";
import { fold } from "@/lib/domain/matching";
import { slotLabel } from "./slot-label";
import { formatMinutes } from "@/lib/domain/recipe";
import type { MenuRecipe, SlotView } from "@/lib/menu/view";
import { CategoryLabel } from "./category";

export interface SlotActions {
  /** Abre la hoja "Lo he cocinado" para este hueco. */
  cook: (slot: SlotView) => void;
  /** Comida de ese día: plato único (true) o primero y segundo (false). */
  setDayCourses: (slotId: string, single: boolean) => void;
  regenerate: (slotId: string) => void;
  toggleLock: (slotId: string) => void;
  setRecipe: (slotId: string, recipeId: string) => void;
  setFreeText: (slotId: string, text: string | null) => void;
}

/** Hoja de acciones de un hueco del menú, con selector de recetas. */
export function SlotSheet({
  slot,
  dayLabel,
  twoCourseLunch = true,
  library,
  actions,
  onClose,
}: {
  slot: SlotView | null;
  dayLabel: string;
  /** La comida es de primero y segundo por defecto (ajustes). */
  twoCourseLunch?: boolean;
  library: MenuRecipe[];
  actions: SlotActions;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? library.filter((r) => fold(r.title).includes(q)) : library;
  }, [library, query]);

  function close() {
    setPicking(false);
    setQuery("");
    onClose();
  }

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  if (!slot) return null;

  return (
    <Sheet open onClose={close}>
      {picking ? (
        <div className="flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-card">
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-3">
            <button type="button" onClick={() => setPicking(false)} aria-label="Volver" className="tap grid size-8 place-items-center text-accent">
              <ChevronLeft className="size-6" />
            </button>
            <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-fill px-3 text-muted">
              <Search className="size-4" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en mis recetas"
                aria-label="Buscar receta"
                className="min-w-0 flex-1 bg-transparent text-ink outline-none"
              />
            </label>
          </div>
          <ul className="divide-y divide-hairline overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={run(() => actions.setRecipe(slot.id, r.id))}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill", r.id === slot.recipe?.id && "bg-accent-soft")}
                >
                  <RecipePhoto photo={r.photo} title={r.title} className="size-11 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]">{r.title}</span>
                    <span className="text-[13px] text-muted">
                      <CategoryLabel category={r.category} />
                      {r.minutes !== null && ` · ${formatMinutes(r.minutes)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-4 py-8 text-center text-[15px] text-muted">Sin resultados</li>}
          </ul>
        </div>
      ) : (
        <>
          <div className="mb-2 overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              {slot.recipe && <RecipePhoto photo={slot.recipe.photo} title={slot.recipe.title} className="size-11 shrink-0 rounded-lg" />}
              <div className="min-w-0">
                <p className="text-[13px] text-muted">
                  {dayLabel} · {slotLabel(slot)}
                </p>
                <p className="truncate text-[16px] font-semibold">{slot.recipe?.title ?? slot.freeText ?? "Sin plato"}</p>
              </div>
            </div>
            {slot.recipe && (
              <Link href={`/recetas/${slot.recipe.id}`} onClick={close} className="flex h-13 items-center gap-3 border-b border-hairline px-4 text-[17px] text-accent active:bg-fill">
                <BookOpen className="size-5" /> Ver receta
              </Link>
            )}
            {slot.recipe && (
              <SheetButton icon={<ChefHat className="size-5" />} onClick={run(() => actions.cook(slot))}>
                {slot.cooked ? "Cocinado ✓ · cambiar valoración" : "Lo he cocinado"}
              </SheetButton>
            )}
            <SheetButton icon={<Shuffle className="size-5" />} onClick={run(() => actions.regenerate(slot.id))}>
              {slot.recipe ? "Otra receta" : "Proponer receta"}
            </SheetButton>
            <SheetButton icon={<Search className="size-5" />} onClick={() => setPicking(true)}>
              Elegir de mis recetas
            </SheetButton>
            <SheetButton
              icon={slot.locked ? <LockOpen className="size-5" /> : <Lock className="size-5" />}
              onClick={run(() => actions.toggleLock(slot.id))}
            >
              {slot.locked ? "Desbloquear" : "Bloquear (no cambiar al regenerar)"}
            </SheetButton>
            <SheetButton icon={<Soup className="size-5" />} onClick={run(() => actions.setFreeText(slot.id, "Sobras"))}>
              Sobras
            </SheetButton>
            <SheetButton icon={<Utensils className="size-5" />} onClick={run(() => actions.setFreeText(slot.id, "Comer fuera"))}>
              Comer fuera
            </SheetButton>
            {slot.meal === "comida" && twoCourseLunch && (
              <SheetButton icon={<Rows2 className="size-5" />} onClick={run(() => actions.setDayCourses(slot.id, slot.course !== "unico"))}>
                {slot.course === "unico" ? "Primero y segundo este día" : "Plato único este día"}
              </SheetButton>
            )}
            <SheetButton icon={<CircleSlash className="size-5" />} onClick={run(() => actions.setFreeText(slot.id, null))} muted>
              Dejar vacío
            </SheetButton>
          </div>
          <button type="button" onClick={close} className="h-14 w-full rounded-2xl bg-card text-[20px] font-semibold text-accent">
            Cancelar
          </button>
        </>
      )}
    </Sheet>
  );
}

function SheetButton({ icon, onClick, children, muted }: { icon: ReactNode; onClick: () => void; children: ReactNode; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-13 w-full items-center gap-3 border-b border-hairline px-4 text-left text-[17px] last:border-b-0 active:bg-fill",
        muted ? "text-muted" : "text-accent",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
