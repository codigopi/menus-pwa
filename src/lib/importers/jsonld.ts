/**
 * Convierte un objeto schema.org/Recipe (JSON-LD) en nuestro modelo de receta.
 * Es la vía "gratis": muchas webs de recetas publican estos datos.
 */
import { parseIngredientLine } from "@/lib/domain/ingredient-parser";
import { normalizeTags, type IngredientInput, type RecipeInput } from "@/lib/domain/recipe";
import { decodeEntities } from "./html";

type Json = Record<string, unknown>;

// Primero decodificar y luego quitar etiquetas: hay webs que escapan el HTML
// dentro del JSON ("&lt;b&gt;40 min&lt;/b&gt;").
const text = (v: unknown): string =>
  typeof v === "string" ? decodeEntities(v).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

/** Duración ISO 8601 ("PT1H20M", "P0DT30M") → minutos. */
export function isoDurationToMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes > 0 && minutes <= 1440 ? minutes : null;
}

/** "4", "4 raciones", ["4", "4 personas"] → 4 */
export function parseYield(v: unknown): number | null {
  const first = Array.isArray(v) ? v[0] : v;
  const n = typeof first === "number" ? first : Number(String(first ?? "").match(/\d+/)?.[0]);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : null;
}

/** recipeInstructions puede ser texto, lista de textos, HowToStep o HowToSection. */
export function flattenInstructions(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    return text(v.replace(/<\/(p|li)>|<br\s*\/?>/gi, "\n"))
      ? v
          .replace(/<\/(p|li)>|<br\s*\/?>/gi, "\n")
          .split(/\n+/)
          .map(text)
          .filter(Boolean)
      : [];
  }
  if (Array.isArray(v)) return v.flatMap(flattenInstructions);
  if (typeof v === "object") {
    const o = v as Json;
    if (o.itemListElement) return flattenInstructions(o.itemListElement);
    const t = text(o.text) || text(o.name);
    return t ? [t] : [];
  }
  return [];
}

function firstImage(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (v && typeof v === "object") return firstImage((v as Json).url ?? (v as Json).contentUrl);
  return null;
}

function keywords(o: Json): string[] {
  const raw = [o.keywords, o.recipeCategory, o.recipeCuisine].flatMap((v) =>
    Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [],
  );
  return normalizeTags(raw.map((t) => text(t)).filter((t) => t.length <= 25)).slice(0, 6);
}

export interface JsonLdDraft {
  draft: RecipeInput;
  image: string | null;
}

export function jsonLdToDraft(o: Json, sourceUrl: string): JsonLdDraft {
  const ingredients: IngredientInput[] = (Array.isArray(o.recipeIngredient) ? o.recipeIngredient : [])
    .map((line) => text(line))
    .filter(Boolean)
    .slice(0, 80)
    .map((line) => parseIngredientLine(line));

  return {
    draft: {
      title: text(o.name).slice(0, 120) || "Receta importada",
      description: text(o.description).slice(0, 600) || null,
      servings: parseYield(o.recipeYield) ?? 2,
      prepMinutes: isoDurationToMinutes(o.prepTime),
      cookMinutes: isoDurationToMinutes(o.cookTime) ?? (o.prepTime ? null : isoDurationToMinutes(o.totalTime)),
      tags: keywords(o),
      ingredients,
      steps: flattenInstructions(o.recipeInstructions)
        .slice(0, 60)
        .map((s) => ({ text: s.slice(0, 2000) })),
      sourceUrl,
      sourceType: "web",
      rating: null,
      isFavorite: false,
    },
    image: firstImage(o.image),
  };
}
