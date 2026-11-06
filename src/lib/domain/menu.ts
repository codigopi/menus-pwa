/**
 * Modelo del menú semanal: parámetros, tipos de plato y clasificación.
 */
import { z } from "zod";
import { tokens } from "./matching";

export const MEALS = ["comida", "cena"] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = { comida: "Comida", cena: "Cena" };

/** Tipo principal del plato, para equilibrar la semana. */
export const CATEGORIES = ["legumbre", "pescado", "carne", "huevo", "pasta_arroz", "verdura"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  legumbre: "Legumbre",
  pescado: "Pescado",
  carne: "Carne",
  huevo: "Huevo",
  pasta_arroz: "Pasta/arroz",
  verdura: "Verdura",
};

export const planParamsSchema = z.object({
  people: z.number().int().min(1).max(20),
  meals: z.array(z.enum(MEALS)).min(1),
  /** Minutos máximos por plato; null = sin límite. */
  maxMinutesWeekday: z.number().int().min(10).max(600).nullable(),
  maxMinutesWeekend: z.number().int().min(10).max(600).nullable(),
  budget: z.enum(["economico", "normal"]),
  vegetarian: z.boolean(),
  /** Ingredientes a evitar ("cerdo", "marisco"…). */
  avoid: z.array(z.string().trim().min(1).max(40)).max(20),
});
export type PlanParams = z.infer<typeof planParamsSchema>;

export const DEFAULT_PARAMS: PlanParams = {
  people: 2,
  meals: ["comida", "cena"],
  maxMinutesWeekday: 45,
  maxMinutesWeekend: null,
  budget: "normal",
  vegetarian: false,
  avoid: [],
};

// ---------------------------------------------------------------- clasificación

const KEYWORDS: Record<Exclude<Category, "verdura">, string[]> = {
  legumbre: ["lenteja", "garbanzo", "alubia", "judion", "haba", "soja", "guisante", "hummus", "fabe"],
  pescado: [
    "pescado", "merluza", "bacalao", "salmon", "atun", "bonito", "sardina", "boqueron", "caballa", "gamba", "langostino",
    "mejillon", "almeja", "calamar", "sepia", "pulpo", "rape", "dorada", "lubina", "trucha", "lenguado", "marisco", "chipiron", "anchoa", "pota",
  ],
  carne: [
    "pollo", "pavo", "ternera", "vaca", "buey", "cerdo", "cordero", "conejo", "carne", "chorizo", "jamon", "bacon", "beicon",
    "panceta", "salchicha", "morcilla", "lomo", "costilla", "solomillo", "secreto", "presa", "hamburguesa", "albondiga", "pechuga", "muslo", "contramuslo",
  ],
  huevo: ["huevo"],
  pasta_arroz: ["pasta", "macarron", "espagueti", "spaghetti", "tallarin", "fideo", "lasana", "canelon", "arroz", "risotto", "noodle", "cuscus", "quinoa", "gnocchi", "nyoqui"],
};

const TAG_CATEGORY: Record<string, Category> = {
  legumbres: "legumbre",
  legumbre: "legumbre",
  pescado: "pescado",
  marisco: "pescado",
  carne: "carne",
  huevos: "huevo",
  pasta: "pasta_arroz",
  arroz: "pasta_arroz",
  verdura: "verdura",
};

/** Orden de prioridad cuando el primer ingrediente no aclara el tipo. */
const PRIORITY: Category[] = ["legumbre", "pescado", "carne", "pasta_arroz", "huevo"];

function categoryOfIngredient(name: string): Category | null {
  const t = tokens(name);
  for (const cat of PRIORITY) {
    if (t.some((tok) => KEYWORDS[cat as Exclude<Category, "verdura">].includes(tok))) return cat;
  }
  return null;
}

export interface ClassifiableRecipe {
  tags: string[];
  ingredients: { name: string }[];
}

/**
 * Tipo de plato:
 *  1. Si alguna etiqueta lo dice ("legumbres", "pescado"…), manda la etiqueta.
 *  2. Si no, el primer ingrediente (suele ser el principal: "lentejas con chorizo").
 *  3. Si no, el primer tipo por prioridad entre todos los ingredientes.
 *  4. Si nada encaja, verdura.
 */
export function classifyRecipe(r: ClassifiableRecipe): Category {
  for (const tag of r.tags) if (TAG_CATEGORY[tag]) return TAG_CATEGORY[tag];
  const first = r.ingredients[0] ? categoryOfIngredient(r.ingredients[0].name) : null;
  if (first) return first;
  const all = r.ingredients.map((i) => categoryOfIngredient(i.name)).filter((c): c is Category => c !== null);
  for (const cat of PRIORITY) if (all.includes(cat)) return cat;
  return "verdura";
}

/** ¿Contiene carne o pescado? (para el modo vegetariano) */
export function hasMeatOrFish(r: ClassifiableRecipe): boolean {
  return r.ingredients.some((i) => {
    const t = tokens(i.name);
    // "caldo de pollo" también cuenta: un vegetariano no lo quiere
    return t.some((tok) => KEYWORDS.carne.includes(tok) || KEYWORDS.pescado.includes(tok));
  });
}
