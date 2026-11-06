/**
 * Casos de uso del menú: une la base de datos con el planificador puro.
 * Solo servidor.
 */
import type { AppDb } from "@/lib/db";
import { getDb } from "@/lib/db";
import { isWeekend, weekDays, type IsoDate } from "@/lib/domain/dates";
import { MEALS, type PlanParams } from "@/lib/domain/menu";
import { planWeek, replanSlot, type PlannerRecipe, type PlannerSlot } from "@/lib/domain/menu-planner";
import { recipeCost } from "@/lib/domain/shopping";
import { tasteScore } from "@/lib/domain/taste";
import { loadTaste } from "@/lib/taste/service";
import { listRecipesForMatching } from "@/lib/recipes/repo";
import { cookedRecently } from "@/lib/history/repo";
import * as repo from "./repo";

/** Lo reciente = lo planificado en menús anteriores + lo realmente cocinado (lo más cercano). */
function recentFor(weekStart: IsoDate, db: AppDb): Map<string, number> {
  const map = repo.recentRecipes(weekStart, 14, db);
  for (const [id, ago] of cookedRecently(weekStart, 14, db)) {
    const prev = map.get(id);
    if (prev === undefined || ago < prev) map.set(id, ago);
  }
  return map;
}

/** Recetas de la biblioteca con su coste orientativo por ración. */
export function plannerRecipes(db: AppDb = getDb()): (PlannerRecipe & ReturnType<typeof listRecipesForMatching>[number])[] {
  const { profile } = loadTaste(db);
  return listRecipesForMatching(db).map((r) => {
    const cost = recipeCost(r.ingredients);
    return { ...r, costPerServing: cost === null ? null : cost / Math.max(1, r.servings), taste: tasteScore(r, profile) };
  });
}

/** Huecos de la semana según las comidas elegidas, conservando los fijos. */
function buildSlots(weekStart: IsoDate, params: PlanParams, previous: repo.SlotRow[]): { slots: PlannerSlot[]; meta: repo.SlotRow[] } {
  const fixed = new Map(previous.filter((s) => s.locked).map((s) => [`${s.date}|${s.meal}`, s]));
  const slots: PlannerSlot[] = [];
  const meta: repo.SlotRow[] = [];
  for (const date of weekDays(weekStart)) {
    for (const meal of MEALS) {
      const keep = fixed.get(`${date}|${meal}`);
      if (!params.meals.includes(meal) && !keep) continue;
      slots.push({ date, meal, weekend: isWeekend(date), ...(keep ? { fixed: keep.recipeId } : {}) });
      meta.push(keep ?? { id: "", date, meal, recipeId: null, freeText: null, locked: false });
    }
  }
  return { slots, meta };
}

/** Genera la semana (o regenera lo no bloqueado si ya existe). */
export function generateWeek(weekStart: IsoDate, params: PlanParams, seed: number, db: AppDb = getDb()): void {
  repo.saveParams(weekStart, params, db); // generar también fija la preferencia
  const previous = repo.getPlan(weekStart, db)?.slots ?? [];
  const { slots, meta } = buildSlots(weekStart, params, previous);
  const { assignments } = planWeek({
    recipes: plannerRecipes(db),
    slots,
    params,
    recent: recentFor(weekStart, db),
    // Lo que había en cada hueco antes de regenerar, para no repetirlo.
    previous: meta.map((m) => previous.find((p) => p.date === m.date && p.meal === m.meal)?.recipeId ?? null),
    seed,
  });
  repo.savePlan(
    weekStart,
    params,
    meta.map((m, i) => ({
      date: m.date,
      meal: m.meal,
      recipeId: m.locked ? m.recipeId : assignments[i],
      freeText: m.locked ? m.freeText : null,
      locked: m.locked,
    })),
    db,
  );
}

/** Cambia la receta de un hueco por otra (respetando el resto del menú). */
export function regenerateSlot(slotId: string, seed: number, db: AppDb = getDb()): void {
  const found = repo.getSlot(slotId, db);
  if (!found) return;
  const plan = repo.getPlan(found.weekStart, db)!;
  const index = plan.slots.findIndex((s) => s.id === slotId);
  const slots: PlannerSlot[] = plan.slots.map((s) => ({ date: s.date, meal: s.meal, weekend: isWeekend(s.date) }));
  const next = replanSlot(
    { recipes: plannerRecipes(db), slots, params: plan.params, recent: recentFor(plan.weekStart, db), seed },
    plan.slots.map((s) => s.recipeId),
    index,
  );
  repo.updateSlot(slotId, { recipeId: next, freeText: null }, db);
}
