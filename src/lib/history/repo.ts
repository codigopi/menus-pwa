/**
 * Histórico de lo cocinado. Solo servidor.
 */
import { randomUUID } from "node:crypto";
import { and, avg, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { cookLogs, recipes } from "@/lib/db/schema";
import { addDays, daysBetween, type IsoDate } from "@/lib/domain/dates";
import type { Meal } from "@/lib/domain/menu";

export type CookLogRow = typeof cookLogs.$inferSelect;

export interface NewCookLog {
  recipeId: string;
  cookedOn: IsoDate;
  meal?: Meal | null;
  slotId?: string | null;
  rating?: number | null;
  notes?: string | null;
}

/**
 * Registra que se cocinó una receta. Si trae valoración, la valoración de la
 * receta pasa a ser la media de todas las veces que se ha valorado.
 */
export function addCookLog(input: NewCookLog, db: AppDb = getDb()): string | null {
  const recipe = db.select({ title: recipes.title }).from(recipes).where(eq(recipes.id, input.recipeId)).get();
  if (!recipe) return null;
  const id = randomUUID();
  db.transaction((tx) => {
    // Un hueco del menú solo se marca una vez: si ya estaba, se reemplaza
    if (input.slotId) tx.delete(cookLogs).where(eq(cookLogs.slotId, input.slotId)).run();
    tx.insert(cookLogs)
      .values({
        id,
        recipeId: input.recipeId,
        recipeTitle: recipe.title,
        cookedOn: input.cookedOn,
        meal: input.meal ?? null,
        slotId: input.slotId ?? null,
        rating: input.rating ?? null,
        notes: input.notes?.trim() || null,
      })
      .run();
    syncRecipeRating(input.recipeId, tx as unknown as AppDb);
  });
  return id;
}

/** Valoración de la receta = media (redondeada) de sus valoraciones al cocinarla. */
function syncRecipeRating(recipeId: string, db: AppDb): void {
  const row = db
    .select({ avg: avg(cookLogs.rating) })
    .from(cookLogs)
    .where(and(eq(cookLogs.recipeId, recipeId), isNotNull(cookLogs.rating)))
    .get();
  if (row?.avg != null) {
    db.update(recipes).set({ rating: Math.round(Number(row.avg)) }).where(eq(recipes.id, recipeId)).run();
  }
}

export function deleteCookLog(id: string, db: AppDb = getDb()): void {
  const log = db.select({ recipeId: cookLogs.recipeId }).from(cookLogs).where(eq(cookLogs.id, id)).get();
  db.delete(cookLogs).where(eq(cookLogs.id, id)).run();
  if (log?.recipeId) syncRecipeRating(log.recipeId, db);
}

export function listCookLogs(limit = 500, db: AppDb = getDb()): CookLogRow[] {
  return db.select().from(cookLogs).orderBy(desc(cookLogs.cookedOn), desc(cookLogs.createdAt)).limit(limit).all();
}

export function logsForRecipe(recipeId: string, db: AppDb = getDb()): CookLogRow[] {
  return db.select().from(cookLogs).where(eq(cookLogs.recipeId, recipeId)).orderBy(desc(cookLogs.cookedOn)).all();
}

/** Recetas cocinadas en los `days` días anteriores a `before` → días transcurridos. */
export function cookedRecently(before: IsoDate, days = 14, db: AppDb = getDb()): Map<string, number> {
  const rows = db
    .select({ recipeId: cookLogs.recipeId, date: cookLogs.cookedOn })
    .from(cookLogs)
    .where(and(gte(cookLogs.cookedOn, addDays(before, -days)), lt(cookLogs.cookedOn, before), isNotNull(cookLogs.recipeId)))
    .all();
  const map = new Map<string, number>();
  for (const { recipeId, date } of rows) {
    const ago = daysBetween(date, before);
    const prev = map.get(recipeId!);
    if (prev === undefined || ago < prev) map.set(recipeId!, ago);
  }
  return map;
}

/** Huecos del menú ya marcados como cocinados. */
export function cookedSlotIds(slotIds: string[], db: AppDb = getDb()): Set<string> {
  if (slotIds.length === 0) return new Set();
  const rows = db.select({ slotId: cookLogs.slotId }).from(cookLogs).where(isNotNull(cookLogs.slotId)).all();
  const wanted = new Set(slotIds);
  return new Set(rows.map((r) => r.slotId!).filter((id) => wanted.has(id)));
}
