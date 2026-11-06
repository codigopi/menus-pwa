import { connection } from "next/server";
import { todayIso } from "@/lib/domain/dates";
import { historyStats, type HistoryStats } from "@/lib/domain/history-stats";
import { listRecipesForMatching } from "@/lib/recipes/repo";
import { listCookLogs } from "./repo";

export interface HistoryView {
  today: string;
  stats: HistoryStats;
  logs: { id: string; recipeId: string | null; recipeTitle: string; cookedOn: string; rating: number | null; notes: string | null }[];
  photos: Record<string, string | null>;
}

export async function loadHistoryView(): Promise<HistoryView> {
  await connection();
  const today = todayIso();
  const recipes = listRecipesForMatching();
  const logs = listCookLogs(500);
  return {
    today,
    stats: historyStats(logs, recipes, today),
    logs: logs.map((l) => ({ id: l.id, recipeId: l.recipeId, recipeTitle: l.recipeTitle, cookedOn: l.cookedOn, rating: l.rating, notes: l.notes })),
    photos: Object.fromEntries(recipes.map((r) => [r.id, r.photo])),
  };
}
