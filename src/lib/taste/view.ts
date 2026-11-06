import { connection } from "next/server";
import { isAiConfigured } from "@/lib/ai/config";
import { rankedCategories, rediscover } from "@/lib/domain/taste";
import type { Category } from "@/lib/domain/menu";
import { loadTaste } from "./service";

export interface TasteView {
  aiEnabled: boolean;
  signals: number;
  categories: { category: Category; label: string; score: number }[];
  liked: string[];
  disliked: string[];
  typicalMinutes: number | null;
  rediscover: { id: string; title: string; photo: string | null; reason: string }[];
}

export async function loadTasteView(): Promise<TasteView> {
  await connection();
  const { recipes, logs, profile, today } = loadTaste();
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return {
    aiEnabled: isAiConfigured(),
    signals: profile.signals,
    categories: rankedCategories(profile),
    liked: profile.liked,
    disliked: profile.disliked,
    typicalMinutes: profile.typicalMinutes,
    rediscover: rediscover(recipes, logs, profile, today).map((s) => ({
      id: s.recipeId,
      title: byId.get(s.recipeId)!.title,
      photo: byId.get(s.recipeId)!.photo,
      reason: s.reason,
    })),
  };
}
