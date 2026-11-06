/**
 * Casos de uso del menú: une la base de datos con el planificador puro.
 * Solo servidor.
 */
import type { AppDb } from "@/lib/db";
import { getDb } from "@/lib/db";
import { isWeekend, weekDays, type IsoDate } from "@/lib/domain/dates";
import { lunchCourses, MEALS, type Course, type PlanParams } from "@/lib/domain/menu";
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

/** Platos de la comida de un día: primero y segundo, salvo que sea día de plato único. */
function coursesFor(meal: "comida" | "cena", date: IsoDate, params: PlanParams, singleDays: IsoDate[]): Course[] {
  if (meal === "cena") return ["unico"];
  return lunchCourses(params.lunchCourses === "dos" && !singleDays.includes(date));
}

/**
 * Huecos de la semana según las comidas y platos elegidos.
 * Conserva los huecos bloqueados (o todos, con keepAll) que sigan existiendo.
 */
function buildSlots(
  weekStart: IsoDate,
  params: PlanParams,
  previous: repo.SlotRow[],
  singleDays: IsoDate[],
  keepAll = false,
): { slots: PlannerSlot[]; meta: repo.SlotRow[] } {
  const fixed = new Map(previous.filter((s) => keepAll || s.locked).map((s) => [repo.slotKey(s), s]));
  const slots: PlannerSlot[] = [];
  const meta: repo.SlotRow[] = [];
  for (const date of weekDays(weekStart)) {
    for (const meal of MEALS) {
      for (const course of coursesFor(meal, date, params, singleDays)) {
        const keep = fixed.get(repo.slotKey({ date, meal, course }));
        if (!params.meals.includes(meal) && !keep) continue;
        slots.push({ date, meal, course, weekend: isWeekend(date), ...(keep ? { fixed: keep.recipeId } : {}) });
        meta.push(keep ?? { id: "", date, meal, course, recipeId: null, freeText: null, locked: false });
      }
    }
  }
  return { slots, meta };
}

/** Rellena con el planificador los huecos sin receta fija y guarda el menú. */
function fillAndSave(
  weekStart: IsoDate,
  params: PlanParams,
  previous: repo.SlotRow[],
  singleDays: IsoDate[],
  seed: number,
  db: AppDb,
  keepAll = false,
): void {
  const { slots, meta } = buildSlots(weekStart, params, previous, singleDays, keepAll);
  const previousByKey = new Map(previous.map((p) => [repo.slotKey(p), p.recipeId]));
  const { assignments } = planWeek({
    recipes: plannerRecipes(db),
    slots,
    params,
    recent: recentFor(weekStart, db),
    // Lo que había en cada hueco antes de regenerar, para no repetirlo.
    previous: meta.map((m) => previousByKey.get(repo.slotKey(m)) ?? null),
    seed,
  });
  repo.savePlan(
    weekStart,
    params,
    meta.map((m, i) => {
      const fixedSlot = slots[i].fixed !== undefined;
      return {
        date: m.date,
        meal: m.meal,
        course: m.course,
        recipeId: fixedSlot ? m.recipeId : assignments[i],
        freeText: fixedSlot ? m.freeText : null,
        locked: m.locked,
      };
    }),
    db,
    singleDays,
  );
}

/** Genera la semana (o regenera lo no bloqueado si ya existe). */
export function generateWeek(weekStart: IsoDate, params: PlanParams, seed: number, db: AppDb = getDb()): void {
  repo.saveParams(weekStart, params, db); // generar también fija la preferencia
  const plan = repo.getPlan(weekStart, db);
  fillAndSave(weekStart, params, plan?.slots ?? [], plan?.singleCourseDays ?? [], seed, db);
}

/**
 * Cambia la comida de un día entre «primero y segundo» y «plato único».
 * El resto del menú no se toca; los nuevos huecos se rellenan solos.
 */
export function setDaySingleCourse(weekStart: IsoDate, date: IsoDate, single: boolean, seed: number, db: AppDb = getDb()): void {
  const plan = repo.getPlan(weekStart, db);
  if (!plan || !weekDays(weekStart).includes(date)) return;
  const days = new Set(plan.singleCourseDays);
  if (single) days.add(date);
  else days.delete(date);
  fillAndSave(weekStart, plan.params, plan.slots, [...days].sort(), seed, db, true);
}

/** Cambia la receta de un hueco por otra (respetando el resto del menú). */
export function regenerateSlot(slotId: string, seed: number, db: AppDb = getDb()): void {
  const found = repo.getSlot(slotId, db);
  if (!found) return;
  const plan = repo.getPlan(found.weekStart, db)!;
  const index = plan.slots.findIndex((s) => s.id === slotId);
  const slots: PlannerSlot[] = plan.slots.map((s) => ({ date: s.date, meal: s.meal, course: s.course, weekend: isWeekend(s.date) }));
  const next = replanSlot(
    { recipes: plannerRecipes(db), slots, params: plan.params, recent: recentFor(plan.weekStart, db), seed },
    plan.slots.map((s) => s.recipeId),
    index,
  );
  repo.updateSlot(slotId, { recipeId: next, freeText: null }, db);
}
