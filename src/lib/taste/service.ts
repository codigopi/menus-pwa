/**
 * Perfil de gustos con datos reales de la casa. Solo servidor.
 */
import { getDb, type AppDb } from "@/lib/db";
import { todayIso } from "@/lib/domain/dates";
import { buildTasteProfile, tasteScore, type TasteProfile } from "@/lib/domain/taste";
import { listCookLogs } from "@/lib/history/repo";
import { listRecipesForMatching } from "@/lib/recipes/repo";

export function loadTaste(db: AppDb = getDb()) {
  const recipes = listRecipesForMatching(db);
  const logs = listCookLogs(1000, db);
  const today = todayIso();
  const profile: TasteProfile = buildTasteProfile(recipes, logs, today);
  return { recipes, logs, profile, today };
}

/** Añade a cada receta su encaje con los gustos (-2…+2). */
export function withTaste<R extends ReturnType<typeof listRecipesForMatching>[number]>(recipes: R[], profile: TasteProfile): (R & { taste: number })[] {
  return recipes.map((r) => ({ ...r, taste: tasteScore(r, profile) }));
}
