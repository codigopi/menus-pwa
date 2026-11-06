/**
 * Perfil de gustos de la casa, aprendido de valoraciones, favoritas e
 * histórico. Puro y sin IA: se recalcula al vuelo.
 *
 * Cada receta con alguna señal aporta un "peso" entre -1 y +1:
 *   valoración (media al cocinarla o la de la ficha): 1★ → -1 … 3★ → 0 … 5★ → +1
 *   favorita: +0.5 · cocinada a menudo (más peso lo reciente): hasta +0.6
 * Con esos pesos se calcula la afinidad por tipo de plato e ingrediente.
 */
import { sectionFor } from "./catalog";
import { daysBetween, type IsoDate } from "./dates";
import { heads } from "./matching";
import { CATEGORIES, CATEGORY_LABELS, classifyRecipe, type Category } from "./menu";
import { totalMinutes } from "./recipe";

export interface TasteRecipe {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  isFavorite: boolean;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: { name: string }[];
}

export interface TasteLog {
  recipeId: string | null;
  cookedOn: IsoDate;
  rating: number | null;
}

export interface TasteProfile {
  /** Recetas con alguna señal (si es bajo, el perfil aún no es fiable). */
  signals: number;
  /** Afinidad por tipo de plato, de -1 a +1. */
  categories: Record<Category, number>;
  /** Afinidad por ingrediente (núcleo normalizado → puntuación y nombre). */
  ingredients: Map<string, { label: string; score: number }>;
  liked: string[];
  disliked: string[];
  /** Minutos habituales de lo que se cocina (mediana). */
  typicalMinutes: number | null;
}

/** Ingredientes tan comunes que no dicen nada de los gustos. */
const NEUTRAL = new Set(["sal", "aceite", "agua", "pimienta", "ajo", "cebolla", "azucar", "harina", "perejil", "laurel", "vinagre", "caldo", "mantequilla", "leche", "huevo"]);

const ingredientKey = (name: string) => heads(name)[0] ?? "";

function recipeWeights(recipes: TasteRecipe[], logs: TasteLog[], today: IsoDate): Map<string, number> {
  const ratings = new Map<string, number[]>();
  const freq = new Map<string, number>();
  for (const l of logs) {
    if (!l.recipeId) continue;
    if (l.rating !== null) ratings.set(l.recipeId, [...(ratings.get(l.recipeId) ?? []), l.rating]);
    // Cada vez cocinada suma; lo de hace >6 meses suma la mitad
    const age = daysBetween(l.cookedOn, today);
    freq.set(l.recipeId, (freq.get(l.recipeId) ?? 0) + (age > 180 ? 0.5 : 1));
  }

  const weights = new Map<string, number>();
  for (const r of recipes) {
    const rs = ratings.get(r.id);
    const rating = rs ? rs.reduce((a, b) => a + b, 0) / rs.length : r.rating;
    let w = 0;
    let hasSignal = false;
    if (rating !== null) {
      w += (rating - 3) / 2;
      hasSignal = true;
    }
    if (r.isFavorite) {
      w += 0.5;
      hasSignal = true;
    }
    const f = freq.get(r.id) ?? 0;
    if (f > 0) {
      w += Math.min(0.6, f * 0.15);
      hasSignal = true;
    }
    if (hasSignal) weights.set(r.id, Math.max(-1, Math.min(1, w)));
  }
  return weights;
}

export function buildTasteProfile(recipes: TasteRecipe[], logs: TasteLog[], today: IsoDate): TasteProfile {
  const weights = recipeWeights(recipes, logs, today);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  // Tipos de plato: media con "encogimiento" (pocas señales → cerca de 0)
  const catSum = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const catN = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const ingSum = new Map<string, { label: string; sum: number; n: number }>();

  for (const [id, w] of weights) {
    const r = byId.get(id)!;
    const c = classifyRecipe(r);
    catSum[c] += w;
    catN[c]++;
    const seen = new Set<string>();
    for (const ing of r.ingredients) {
      const key = ingredientKey(ing.name);
      // Básicos y especias no dicen nada de los gustos
      if (!key || NEUTRAL.has(key) || seen.has(key) || sectionFor(ing.name) === "especias") continue;
      seen.add(key);
      const e = ingSum.get(key) ?? { label: key, sum: 0, n: 0 };
      // Etiqueta legible: el nombre más corto visto
      if (ing.name.length < e.label.length || e.n === 0) e.label = ing.name.toLowerCase();
      e.sum += w;
      e.n++;
      ingSum.set(key, e);
    }
  }

  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, catSum[c] / (catN[c] + 1)])) as Record<Category, number>;
  const ingredients = new Map([...ingSum].map(([k, e]) => [k, { label: e.label, score: e.sum / (e.n + 1) }]));
  const sorted = [...ingredients.values()].sort((a, b) => b.score - a.score);

  // Tiempo habitual: mediana de lo cocinado (o, si no hay, de lo bien valorado)
  const cookedIds = new Set(logs.map((l) => l.recipeId).filter(Boolean) as string[]);
  const timeSource = recipes.filter((r) => cookedIds.has(r.id) || (weights.get(r.id) ?? 0) > 0.3);
  const minutes = timeSource.map(totalMinutes).filter((m): m is number => m !== null).sort((a, b) => a - b);

  return {
    signals: weights.size,
    categories,
    ingredients,
    liked: sorted.filter((i) => i.score >= 0.25).slice(0, 8).map((i) => i.label),
    disliked: sorted.filter((i) => i.score <= -0.25).reverse().slice(0, 6).map((i) => i.label),
    typicalMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null,
  };
}

/** Cuánto encaja una receta con los gustos de la casa: de -2 a +2. */
export function tasteScore(recipe: TasteRecipe, profile: TasteProfile): number {
  if (profile.signals === 0) return 0;
  const cat = profile.categories[classifyRecipe(recipe)];
  const scores = recipe.ingredients
    .map((i) => profile.ingredients.get(ingredientKey(i.name))?.score)
    .filter((s): s is number => s !== undefined);
  const ing = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return Math.max(-2, Math.min(2, cat * 1.2 + ing * 1.5));
}

/** Tipos de plato ordenados por afinidad (para mostrar). */
export function rankedCategories(profile: TasteProfile): { category: Category; label: string; score: number }[] {
  return CATEGORIES.map((c) => ({ category: c, label: CATEGORY_LABELS[c], score: profile.categories[c] })).sort((a, b) => b.score - a.score);
}

/** Resumen en texto para orientar a la IA al proponer platos nuevos. */
export function describeProfile(profile: TasteProfile): string {
  if (profile.signals < 3) return "Aún hay pocas valoraciones: propón platos caseros variados y populares.";
  const top = rankedCategories(profile).filter((c) => c.score > 0.1).slice(0, 3).map((c) => c.label.toLowerCase());
  const low = rankedCategories(profile).filter((c) => c.score < -0.1).map((c) => c.label.toLowerCase());
  const parts = [];
  if (top.length) parts.push(`Tipos de plato que más gustan: ${top.join(", ")}.`);
  if (low.length) parts.push(`Gustan menos: ${low.join(", ")}.`);
  if (profile.liked.length) parts.push(`Ingredientes favoritos: ${profile.liked.join(", ")}.`);
  if (profile.disliked.length) parts.push(`Ingredientes que no convencen: ${profile.disliked.join(", ")}.`);
  if (profile.typicalMinutes) parts.push(`Suelen cocinar platos de unos ${profile.typicalMinutes} minutos.`);
  return parts.join(" ");
}

export interface Rediscovery {
  recipeId: string;
  reason: string;
  score: number;
}

/**
 * Recetas de la biblioteca para "redescubrir": encajan con los gustos y hace
 * tiempo que no se hacen (o nunca). Cada una con un motivo legible.
 */
export function rediscover(recipes: TasteRecipe[], logs: TasteLog[], profile: TasteProfile, today: IsoDate, limit = 6): Rediscovery[] {
  const last = new Map<string, IsoDate>();
  for (const l of logs) if (l.recipeId && (!last.get(l.recipeId) || l.cookedOn > last.get(l.recipeId)!)) last.set(l.recipeId, l.cookedOn);

  return recipes
    .map((r) => {
      const t = tasteScore(r, profile);
      const lastOn = last.get(r.id);
      const ago = lastOn ? daysBetween(lastOn, today) : null;
      if (ago !== null && ago < 21) return null; // hecha hace poco
      let score = t + (r.isFavorite ? 0.5 : 0) + ((r.rating ?? 3) - 3) * 0.3;
      let reason: string;
      if (ago !== null && ago > 45 && (r.rating ?? 0) >= 4) {
        score += 0.8;
        reason = `Os gustó y hace ${ago > 60 ? `${Math.round(ago / 30)} meses` : `${ago} días`} que no la hacéis`;
      } else if (ago === null) {
        const cat = classifyRecipe(r);
        reason = profile.categories[cat] > 0.15 ? `Sin estrenar · os gusta la ${CATEGORY_LABELS[cat].toLowerCase()}` : "Aún sin estrenar";
        score += 0.2;
      } else {
        reason = `Hace ${ago} días que no la hacéis`;
      }
      return { recipeId: r.id, reason, score };
    })
    .filter((x): x is Rediscovery => x !== null && x.score > -0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
