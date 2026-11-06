/**
 * Estadísticas básicas del histórico de cocina. Puro.
 */
import { daysBetween, type IsoDate } from "./dates";
import { classifyRecipe, type Category, type ClassifiableRecipe } from "./menu";

export interface LogLike {
  recipeId: string | null;
  recipeTitle: string;
  cookedOn: IsoDate;
  rating: number | null;
}

export interface RecipeLike extends ClassifiableRecipe {
  id: string;
  title: string;
  rating: number | null;
}

export interface HistoryStats {
  last30: number;
  thisMonth: number;
  /** Lo más cocinado (todas las fechas). */
  topCooked: { recipeId: string | null; title: string; count: number }[];
  /** Mejor valorado al cocinarlo (media). */
  bestRated: { recipeId: string; title: string; avg: number; count: number }[];
  /** Bien valoradas que hace más de un mes que no se hacen. */
  missYou: { recipeId: string; title: string; daysAgo: number }[];
  /** Recetas de la biblioteca que nunca se han cocinado. */
  neverCooked: { recipeId: string; title: string }[];
  /** Tipos de plato de los últimos 30 días. */
  categories: Partial<Record<Category, number>>;
}

export function historyStats(logs: LogLike[], recipes: RecipeLike[], today: IsoDate): HistoryStats {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const month = today.slice(0, 7);
  const recent = logs.filter((l) => {
    const d = daysBetween(l.cookedOn, today);
    return d >= 0 && d < 30;
  });

  // Más cocinado (agrupando por receta o por título si se borró)
  const counts = new Map<string, { recipeId: string | null; title: string; count: number }>();
  for (const l of logs) {
    const key = l.recipeId ?? `t:${l.recipeTitle}`;
    const entry = counts.get(key) ?? { recipeId: l.recipeId, title: byId.get(l.recipeId ?? "")?.title ?? l.recipeTitle, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  const topCooked = [...counts.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "es")).slice(0, 5);

  // Mejor valorado al cocinarlo
  const ratings = new Map<string, number[]>();
  for (const l of logs) {
    if (!l.recipeId || l.rating === null || !byId.has(l.recipeId)) continue;
    ratings.set(l.recipeId, [...(ratings.get(l.recipeId) ?? []), l.rating]);
  }
  const bestRated = [...ratings.entries()]
    .map(([recipeId, rs]) => ({ recipeId, title: byId.get(recipeId)!.title, avg: rs.reduce((s, r) => s + r, 0) / rs.length, count: rs.length }))
    .filter((r) => r.avg >= 3.5)
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 5);

  // Última vez de cada receta
  const last = new Map<string, IsoDate>();
  for (const l of logs) {
    if (!l.recipeId) continue;
    const prev = last.get(l.recipeId);
    if (!prev || l.cookedOn > prev) last.set(l.recipeId, l.cookedOn);
  }
  const missYou = recipes
    .filter((r) => (r.rating ?? 0) >= 4 && last.has(r.id))
    .map((r) => ({ recipeId: r.id, title: r.title, daysAgo: daysBetween(last.get(r.id)!, today) }))
    .filter((r) => r.daysAgo > 30)
    .sort((a, b) => b.daysAgo - a.daysAgo)
    .slice(0, 5);

  const neverCooked = recipes.filter((r) => !last.has(r.id)).map((r) => ({ recipeId: r.id, title: r.title }));

  const categories: Partial<Record<Category, number>> = {};
  for (const l of recent) {
    const r = l.recipeId ? byId.get(l.recipeId) : undefined;
    if (!r) continue;
    const c = classifyRecipe(r);
    categories[c] = (categories[c] ?? 0) + 1;
  }

  return {
    last30: recent.length,
    thisMonth: logs.filter((l) => l.cookedOn.startsWith(month)).length,
    topCooked,
    bestRated,
    missYou,
    neverCooked,
    categories,
  };
}
