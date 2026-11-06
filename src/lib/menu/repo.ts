/**
 * Acceso a datos del menú semanal. Solo servidor. Funciones síncronas
 * (better-sqlite3) con la BD inyectable para tests.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { mealPlans, mealSlots } from "@/lib/db/schema";
import { addDays, daysBetween, type IsoDate } from "@/lib/domain/dates";
import { DEFAULT_PARAMS, type Meal, type PlanParams } from "@/lib/domain/menu";
import { getSetting, setSetting } from "@/lib/settings";

export interface SlotRow {
  id: string;
  date: IsoDate;
  meal: Meal;
  recipeId: string | null;
  freeText: string | null;
  locked: boolean;
}

export interface PlanRow {
  id: string;
  weekStart: IsoDate;
  params: PlanParams;
  slots: SlotRow[];
}

const MEAL_ORDER: Record<Meal, number> = { comida: 0, cena: 1 };

export function getPlan(weekStart: IsoDate, db: AppDb = getDb()): PlanRow | null {
  const plan = db.select().from(mealPlans).where(eq(mealPlans.weekStart, weekStart)).get();
  if (!plan) return null;
  const slots = db
    .select({
      id: mealSlots.id,
      date: mealSlots.date,
      meal: mealSlots.meal,
      recipeId: mealSlots.recipeId,
      freeText: mealSlots.freeText,
      locked: mealSlots.locked,
    })
    .from(mealSlots)
    .where(eq(mealSlots.planId, plan.id))
    .orderBy(asc(mealSlots.date))
    .all()
    .sort((a, b) => a.date.localeCompare(b.date) || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]);
  return { id: plan.id, weekStart: plan.weekStart, params: { ...DEFAULT_PARAMS, ...plan.params }, slots };
}

const PARAMS_KEY = "menu.params";

/**
 * Ajustes del menú preferidos por la casa (para semanas nuevas).
 * Orden: preferencia guardada → último menú generado → valores por defecto.
 */
export function latestParams(db: AppDb = getDb()): PlanParams {
  const saved = getSetting<Partial<PlanParams>>(PARAMS_KEY, db);
  if (saved) return { ...DEFAULT_PARAMS, ...saved };
  const last = db.select({ params: mealPlans.params }).from(mealPlans).orderBy(desc(mealPlans.weekStart)).limit(1).get();
  return last ? { ...DEFAULT_PARAMS, ...last.params } : DEFAULT_PARAMS;
}

/** Guarda los ajustes como preferencia y, si hay menú esa semana, en el menú (sin regenerarlo). */
export function saveParams(weekStart: IsoDate, params: PlanParams, db: AppDb = getDb()): { hasPlan: boolean } {
  setSetting(PARAMS_KEY, params, db);
  const res = db.update(mealPlans).set({ params }).where(eq(mealPlans.weekStart, weekStart)).run();
  return { hasPlan: res.changes > 0 };
}

/** Recetas de menús de los `days` días anteriores → días que han pasado. */
export function recentRecipes(weekStart: IsoDate, days = 14, db: AppDb = getDb()): Map<string, number> {
  const rows = db
    .select({ recipeId: mealSlots.recipeId, date: mealSlots.date })
    .from(mealSlots)
    .where(and(gte(mealSlots.date, addDays(weekStart, -days)), lt(mealSlots.date, weekStart), isNotNull(mealSlots.recipeId)))
    .all();
  const map = new Map<string, number>();
  for (const { recipeId, date } of rows) {
    const ago = daysBetween(date, weekStart);
    const prev = map.get(recipeId!);
    if (prev === undefined || ago < prev) map.set(recipeId!, ago);
  }
  return map;
}

export type NewSlot = Omit<SlotRow, "id">;

/** Crea o reemplaza el menú de una semana (con todos sus huecos). */
export function savePlan(weekStart: IsoDate, params: PlanParams, slots: NewSlot[], db: AppDb = getDb()): string {
  return db.transaction((tx) => {
    const existing = tx.select({ id: mealPlans.id }).from(mealPlans).where(eq(mealPlans.weekStart, weekStart)).get();
    const planId = existing?.id ?? randomUUID();
    if (existing) {
      tx.update(mealPlans).set({ params }).where(eq(mealPlans.id, planId)).run();
      tx.delete(mealSlots).where(eq(mealSlots.planId, planId)).run();
    } else {
      tx.insert(mealPlans).values({ id: planId, weekStart, params }).run();
    }
    if (slots.length) tx.insert(mealSlots).values(slots.map((s) => ({ ...s, id: randomUUID(), planId }))).run();
    return planId;
  });
}

export function getSlot(slotId: string, db: AppDb = getDb()) {
  const row = db
    .select({ slot: mealSlots, weekStart: mealPlans.weekStart })
    .from(mealSlots)
    .innerJoin(mealPlans, eq(mealSlots.planId, mealPlans.id))
    .where(eq(mealSlots.id, slotId))
    .get();
  return row ?? null;
}

export function updateSlot(
  slotId: string,
  patch: Partial<Pick<SlotRow, "recipeId" | "freeText" | "locked">>,
  db: AppDb = getDb(),
): void {
  db.update(mealSlots).set(patch).where(eq(mealSlots.id, slotId)).run();
}

export function deletePlan(weekStart: IsoDate, db: AppDb = getDb()): void {
  db.delete(mealPlans).where(eq(mealPlans.weekStart, weekStart)).run();
}
