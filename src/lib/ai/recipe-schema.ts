/**
 * Esquema de la salida estructurada que pedimos a la IA y su normalización
 * a nuestro modelo de receta. Puro y testeable (no llama a la API).
 *
 * El esquema de IA es deliberadamente sencillo (sin min/max): los límites los
 * aplicamos nosotros al normalizar, así una respuesta "casi buena" se
 * aprovecha en vez de fallar entera.
 */
import { z } from "zod";
import { normalizeTags, recipeInputSchema, type RecipeInput, type SourceType } from "@/lib/domain/recipe";
import { UNIT_KEYS } from "@/lib/domain/units";

export const aiRecipeSchema = z.object({
  is_recipe: z.boolean().describe("true si el contenido describe una receta de cocina"),
  problem: z
    .string()
    .nullable()
    .describe("Si no es una receta o falta casi todo, explica brevemente qué falta (en español). Si no, null."),
  title: z.string(),
  description: z.string().nullable().describe("Una o dos frases; null si la fuente no da nada útil"),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  ingredients: z.array(
    z.object({
      quantity: z.number().nullable().describe("Número decimal; null si es 'al gusto' o no se indica"),
      unit: z.enum(UNIT_KEYS).nullable().describe("Clave de unidad o null para piezas sueltas (2 huevos)"),
      name: z.string().describe("Solo el ingrediente, en minúsculas, sin cantidad ni preparación"),
      note: z.string().nullable().describe("Preparación o aclaración: 'picada', 'en dados', 'opcional'"),
      group: z.string().nullable().describe("Sección si la receta las tiene: 'Para la salsa'"),
    }),
  ),
  steps: z.array(z.string()),
  tags: z.array(z.string()),
  warnings: z
    .array(z.string())
    .describe("Avisos para la persona que revisa: datos que faltaban, cosas deducidas, dudas"),
});

export type AiRecipe = z.infer<typeof aiRecipeSchema>;

const clampInt = (v: number | null, min: number, max: number) =>
  v === null || !Number.isFinite(v) ? null : Math.min(max, Math.max(min, Math.round(v)));

/**
 * Respuesta de la IA → receta válida. Recorta longitudes, descarta filas
 * vacías y aplica valores por defecto razonables.
 */
export function normalizeAiRecipe(
  ai: AiRecipe,
  source: { sourceType: SourceType; sourceUrl: string | null },
): { draft: RecipeInput; warnings: string[] } {
  const warnings = ai.warnings.map((w) => w.trim()).filter(Boolean).slice(0, 6);

  const servings = clampInt(ai.servings, 1, 50);
  if (servings === null) warnings.push("No se indicaban las raciones: he puesto 2.");

  const draft = recipeInputSchema.parse({
    title: ai.title.trim().slice(0, 120) || "Receta importada",
    description: ai.description?.trim().slice(0, 600) || null,
    servings: servings ?? 2,
    prepMinutes: clampInt(ai.prep_minutes, 0, 1440),
    cookMinutes: clampInt(ai.cook_minutes, 0, 1440),
    tags: normalizeTags(ai.tags).slice(0, 6),
    ingredients: ai.ingredients
      .filter((i) => i.name.trim())
      .slice(0, 80)
      .map((i) => ({
        quantity: i.quantity !== null && i.quantity > 0 && i.quantity <= 100_000 ? i.quantity : null,
        unit: i.unit,
        name: i.name.trim().slice(0, 120),
        note: i.note?.trim().slice(0, 120) || null,
        group: i.group?.trim().slice(0, 60) || null,
      })),
    steps: ai.steps
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60)
      .map((text) => ({ text: text.slice(0, 2000) })),
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    rating: null,
    isFavorite: false,
  });

  return { draft, warnings };
}
