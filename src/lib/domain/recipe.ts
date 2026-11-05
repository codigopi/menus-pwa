/**
 * Modelo de receta: esquema de validación (Zod) compartido por formularios,
 * Server Actions y, más adelante, por la salida estructurada del LLM.
 */
import { z } from "zod";
import { UNIT_KEYS } from "./units";

export const SOURCE_TYPES = [
  "manual",
  "web",
  "instagram",
  "tiktok",
  "youtube",
  "texto",
  "captura",
  "generada",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  manual: "Escrita a mano",
  web: "Web",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  texto: "Texto pegado",
  captura: "Captura de pantalla",
  generada: "Generada",
};

/** Etiquetas sugeridas en el formulario (el usuario puede crear otras). */
export const SUGGESTED_TAGS = [
  "cuchara",
  "legumbres",
  "verdura",
  "pescado",
  "carne",
  "pasta",
  "arroz",
  "huevos",
  "horno",
  "rápida",
  "aprovechamiento",
  "batch cooking",
  "cena ligera",
  "postre",
];

/** Texto opcional: recorta espacios y convierte "" en null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const minutes = z.number().int().min(0).max(24 * 60).nullable();

/** Normaliza etiquetas: minúsculas, sin espacios extra, sin duplicados. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = tag.trim().replace(/\s+/g, " ").toLowerCase();
    if (clean && clean.length <= 30) seen.add(clean);
  }
  return [...seen];
}

export const ingredientSchema = z.object({
  /** null = "al gusto" */
  quantity: z.number().positive().max(100_000).nullable(),
  unit: z.enum(UNIT_KEYS).nullable(),
  name: z.string().trim().min(1, "Falta el nombre del ingrediente").max(120),
  note: optionalText(120),
  /** Sección dentro de la receta, p. ej. "Para la salsa" */
  group: optionalText(60),
});

export const stepSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un título").max(120, "Título demasiado largo"),
  description: optionalText(600),
  servings: z.number().int().min(1).max(50),
  prepMinutes: minutes,
  cookMinutes: minutes,
  tags: z.array(z.string()).max(20).transform(normalizeTags),
  ingredients: z.array(ingredientSchema).max(80),
  steps: z.array(stepSchema).max(60),
  sourceUrl: z
    .union([z.url({ message: "El enlace no parece válido" }), z.literal("")])
    .nullish()
    .transform((v) => (v ? v : null)),
  sourceType: z.enum(SOURCE_TYPES).default("manual"),
  /** 1–5 estrellas; null = sin valorar */
  rating: z.number().int().min(1).max(5).nullable(),
  isFavorite: z.boolean().default(false),
});

export type IngredientInput = z.output<typeof ingredientSchema>;
export type RecipeStep = z.output<typeof stepSchema>;
export type RecipeInput = z.output<typeof recipeInputSchema>;

/** Receta tal como la devuelve la base de datos. */
export interface Recipe extends RecipeInput {
  id: string;
  photo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos mínimos para listados. */
export type RecipeSummary = Pick<
  Recipe,
  "id" | "title" | "photo" | "tags" | "servings" | "prepMinutes" | "cookMinutes" | "rating" | "isFavorite"
>;

/** Tiempo total en minutos (o null si no hay ningún dato). */
export function totalMinutes(r: Pick<Recipe, "prepMinutes" | "cookMinutes">): number | null {
  if (r.prepMinutes === null && r.cookMinutes === null) return null;
  return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
}

/** "45 min", "1 h", "1 h 20 min" */
export function formatMinutes(min: number | null): string {
  if (min === null) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Etiqueta para mostrar: primera letra en mayúscula ("batch cooking" → "Batch cooking"). */
export const tagLabel = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1);
