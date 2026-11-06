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

/** Platos de un hueco del menú: comida con primero y segundo, o plato único. */
export const COURSES = ["primero", "segundo", "unico"] as const;
export type Course = (typeof COURSES)[number];
export const COURSE_LABELS: Record<Course, string> = { primero: "Primero", segundo: "Segundo", unico: "Plato único" };

export const planParamsSchema = z.object({
  people: z.number().int().min(1).max(20),
  meals: z.array(z.enum(MEALS)).min(1),
  /** Comida con primero y segundo (lo habitual) o plato único. La cena es siempre un plato. */
  lunchCourses: z.enum(["dos", "unico"]),
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
  lunchCourses: "dos",
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
    "morcillo", "tocino", "lacon", "codillo", "cecina", "carrillada", "rabo", "oreja", "chistorra", "butifarra",
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

// ---------------------------------------------------------------- primero / segundo

/** Platos de los huecos de una comida según su estructura. */
export function lunchCourses(twoCourses: boolean): Course[] {
  return twoCourses ? ["primero", "segundo"] : ["unico"];
}

/**
 * Papel natural de una receta en una comida española:
 *  - primero: legumbres, verduras, cremas, pasta, arroz, ensaladas
 *  - segundo: carne, pescado, huevos
 * Las etiquetas "primero", "segundo" o "plato único" mandan.
 */
export function courseRole(r: ClassifiableRecipe): Course {
  if (r.tags.includes("plato único") || r.tags.includes("plato unico")) return "unico";
  if (r.tags.includes("primero")) return "primero";
  if (r.tags.includes("segundo")) return "segundo";
  const cat = classifyRecipe(r);
  return cat === "carne" || cat === "pescado" || cat === "huevo" ? "segundo" : "primero";
}

/**
 * ¿Puede ir esta receta en esa comida? Etiquetas "comida" / "cena":
 * con solo una de ellas, la receta es exclusiva de esa comida; con las dos
 * o con ninguna, vale para cualquiera.
 */
export function fitsMeal(r: { tags: string[] }, meal: Meal): boolean {
  const lunch = r.tags.includes("comida");
  const dinner = r.tags.includes("cena");
  if (lunch === dinner) return true;
  return meal === "comida" ? lunch : dinner;
}

/** ¿Es un plato completo, apropiado como plato único? (cocido, lentejas con chorizo…) */
export function isWholeMeal(r: ClassifiableRecipe): boolean {
  if (courseRole(r) === "unico") return true;
  const cat = classifyRecipe(r);
  // Legumbre, pasta o arroz con carne o pescado: plato completo
  return (cat === "legumbre" || cat === "pasta_arroz") && hasMeatOrFish(r);
}
