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

/** Huecos sin receta: "Sobras", "Comer fuera"… */
export const FREE_TEXTS = ["Sobras", "Comer fuera", "Pedir a domicilio", "Improvisar"] as const;
export type FreeText = (typeof FREE_TEXTS)[number];

/** Días de la plantilla: 0 = lunes … 6 = domingo. */
export const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

/**
 * Entrada de la plantilla semanal: lo que se hace siempre ese día
 * (p. ej. viernes cena → Pizza, sábado cena → Pedir a domicilio).
 * Lleva una receta o un texto, nunca las dos cosas.
 */
export const templateEntrySchema = z
  .object({
    day: z.number().int().min(0).max(6),
    meal: z.enum(MEALS),
    recipeId: z.string().min(1).nullable(),
    text: z.enum(FREE_TEXTS).nullable(),
  })
  .refine((e) => (e.recipeId === null) !== (e.text === null), "Receta o texto, uno de los dos");
export type TemplateEntry = z.infer<typeof templateEntrySchema>;

export const sameTemplateSlot = (a: Pick<TemplateEntry, "day" | "meal">, b: Pick<TemplateEntry, "day" | "meal">) =>
  a.day === b.day && a.meal === b.meal;

export const planParamsSchema = z.object({
  adults: z.number().int().min(1).max(12),
  /** Niños: comen raciones algo menores y no deben tomar pescados con mucho mercurio. */
  children: z.number().int().min(0).max(12),
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
  /** Plantilla semanal: huecos que se rellenan siempre igual al crear el menú. */
  template: z
    .array(templateEntrySchema)
    .max(14)
    .refine((t) => t.every((e, i) => t.findIndex((o) => sameTemplateSlot(o, e)) === i), "Un hueco repetido en la plantilla"),
});
export type PlanParams = z.infer<typeof planParamsSchema>;

export const DEFAULT_PARAMS: PlanParams = {
  adults: 2,
  children: 0,
  meals: ["comida", "cena"],
  lunchCourses: "dos",
  maxMinutesWeekday: null, // sin límite: el tiempo no condiciona el menú salvo que se configure
  maxMinutesWeekend: null,
  budget: "normal",
  vegetarian: false,
  avoid: [],
  template: [],
};

/** Ración de un niño respecto a la de un adulto (orientativo). */
export const CHILD_PORTION = 0.7;

/** Raciones equivalentes de la familia (2 adultos + 3 niños ≈ 4,1). */
export function portions(p: Pick<PlanParams, "adults" | "children">): number {
  return p.adults + p.children * CHILD_PORTION;
}

/** "2 adultos y 3 niños" */
export function familyLabel(p: Pick<PlanParams, "adults" | "children">): string {
  const a = `${p.adults} ${p.adults === 1 ? "adulto" : "adultos"}`;
  return p.children ? `${a} y ${p.children} ${p.children === 1 ? "niño" : "niños"}` : a;
}

/**
 * Ajustes guardados → ajustes actuales. Convierte el formato antiguo
 * ("people": 5) en adultos, y completa lo que falte con los valores por defecto.
 */
export function normalizeParams(raw: unknown): PlanParams {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PlanParams> & { people?: number };
  const { people, ...rest } = r;
  const merged = { ...DEFAULT_PARAMS, ...rest };
  if (rest.adults === undefined && typeof people === "number") merged.adults = Math.max(1, Math.min(12, people));
  const parsed = planParamsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PARAMS;
}

// ---------------------------------------------------------------- clasificación

const KEYWORDS: Record<Exclude<Category, "verdura">, string[]> = {
  legumbre: ["lenteja", "garbanzo", "alubia", "judion", "haba", "soja", "guisante", "hummus", "fabe", "pipo", "pocha", "frijol"],
  pescado: [
    "pescado", "merluza", "bacalao", "salmon", "atun", "bonito", "sardina", "boqueron", "caballa", "gamba", "langostino",
    "mejillon", "almeja", "calamar", "sepia", "pulpo", "rape", "dorada", "lubina", "gallo", "trucha", "lenguado", "marisco", "chipiron", "anchoa", "pota",
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
