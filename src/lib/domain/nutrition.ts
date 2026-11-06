/**
 * Equilibrio nutricional del menú semanal, según las recomendaciones
 * españolas para población general (AESAN 2022 y pirámide SENC):
 *
 *   legumbres 3–4/sem · pescado 3–4/sem (1–2 azul) · huevos 2–4/sem
 *   carne ≤4/sem, mejor blanca (roja ≤2) · carne procesada ocasional (≤2)
 *   fritos/rebozados ocasionales (≤2) · comida rápida ocasional (≤2)
 *   verdura en comida y cena, todos los días
 *   con niños: evitar pez espada, emperador, atún rojo, tiburón/cazón y lucio
 *
 * Son objetivos orientativos para una familia, no una dieta clínica.
 * Todo es puro y se basa en los ingredientes y el título de cada receta.
 */
import { findCatalog } from "./catalog";
import { fold, tokens } from "./matching";
import { classifyRecipe, type Category } from "./menu";

export interface NutritionRecipe {
  title: string;
  tags: string[];
  ingredients: { name: string; note?: string | null }[];
}

export interface NutritionFlags {
  category: Category;
  /** Carne principal del plato (si la hay). */
  meat: "blanca" | "roja" | null;
  /** Lleva carne procesada (chorizo, bacon, salchichas, jamón cocido…). */
  processedMeat: boolean;
  oilyFish: boolean;
  fried: boolean;
  fastFood: boolean;
  /** Aporta verdura u hortaliza (no cuentan patata, ajo, cebolla ni hierbas). */
  vegetables: boolean;
  /** Pescado con mucho mercurio: a evitar en niños. */
  highMercury: boolean;
}

const WHITE_MEAT = new Set(["pollo", "pavo", "conejo", "pechuga", "muslo", "contramuslo", "alita"]);
const RED_MEAT = new Set(["ternera", "vaca", "buey", "cerdo", "cordero", "lomo", "solomillo", "costilla", "carrillada", "morcillo", "secreto", "presa", "carne", "albondiga", "rabo", "codillo"]);
const PROCESSED = new Set([
  "chorizo", "bacon", "beicon", "panceta", "salchicha", "jamon", "morcilla", "fuet", "salami", "mortadela", "butifarra",
  "chistorra", "sobrasada", "lacon", "cecina", "nugget", "hamburguesa", "salchichon", "pate", "frankfurt",
]);
const OILY_FISH = new Set(["salmon", "sardina", "caballa", "boqueron", "atun", "bonito", "anchoa", "jurel", "trucha", "arenque", "palometa"]);
/** Combinaciones de palabras: "pez espada", "atún rojo"… */
const HIGH_MERCURY: string[][] = [["pez", "espada"], ["emperador"], ["atun", "rojo"], ["tiburon"], ["cazon"], ["lucio"], ["marrajo"], ["tintorera"]];
const FRIED_WORDS = ["frito", "frita", "fritos", "fritas", "empanado", "empanada", "empanados", "empanadas", "rebozado", "rebozada", "rebozados", "rebozadas", "libritos", "nuggets", "croquetas", "san jacobo"];
const FAST_FOOD_WORDS = ["pizza", "nugget", "perrito", "hamburguesa", "kebab", "sandwich", "hot dog", "lasana precocinada"];
/** Hortalizas que no cuentan como "verdura" a efectos de la pirámide. */
const NOT_VEG = new Set(["patata", "ajo", "cebolla", "cebolleta", "limon", "lima", "perejil", "cilantro", "albahaca", "hierbabuena", "jengibre", "naranja", "manzana", "platano", "pera", "fresa", "boniato"]);

const titleHas = (title: string, words: string[]) => {
  const t = ` ${fold(title).replace(/[^a-z0-9ñ ]/g, " ")} `;
  return words.some((w) => t.includes(` ${fold(w)}`));
};

export function nutritionFlags(r: NutritionRecipe): NutritionFlags {
  const category = classifyRecipe(r);
  let meat: NutritionFlags["meat"] = null;
  let processedMeat = false;
  let oilyFish = false;
  let highMercury = false;
  let vegetables = false;
  let fryingOil = false;

  for (const ing of r.ingredients) {
    const t = tokens(ing.name);
    // "hamburguesas de pescado" no es carne procesada
    // ni el pan ("pan de hamburguesa", "pan de perrito")
    const isFishProduct = t.includes("pescado");
    const isBread = t[0] === "pan";
    if (!isFishProduct && !isBread && t.some((w) => PROCESSED.has(w))) processedMeat = true;
    if (meat === null) {
      if (t.some((w) => WHITE_MEAT.has(w))) meat = "blanca";
      else if (t.some((w) => RED_MEAT.has(w))) meat = "roja";
    }
    if (t.some((w) => OILY_FISH.has(w))) oilyFish = true;
    if (HIGH_MERCURY.some((combo) => combo.every((w) => t.includes(w)))) highMercury = true;
    if (/fre[ií]r/i.test(ing.note ?? "")) fryingOil = true;

    const entry = findCatalog(ing.name);
    const isVeg =
      (entry?.section === "fruteria" && !NOT_VEG.has(entry.match)) ||
      entry?.match === "guisante" ||
      t[0] === "verdura" ||
      t[0] === "pisto";
    if (isVeg) vegetables = true;
  }
  return {
    category,
    // Solo cuenta como plato de carne si la carne es lo principal; una
    // hamburguesa o unas salchichas (procesadas) cuentan como carne roja.
    meat: category === "carne" ? (meat ?? (processedMeat ? "roja" : null)) : null,
    processedMeat,
    oilyFish: category === "pescado" && oilyFish,
    fried: fryingOil || titleHas(r.title, FRIED_WORDS),
    fastFood: titleHas(r.title, FAST_FOOD_WORDS) || r.ingredients.some((i) => tokens(i.name).includes("nugget")),
    vegetables,
    highMercury,
  };
}

// ---------------------------------------------------------------- reglas semanales

export type RuleId =
  | "legumbre"
  | "pescado"
  | "pescado_azul"
  | "huevo"
  | "carne"
  | "carne_roja"
  | "procesada"
  | "fritos"
  | "rapida"
  | "verdura_diaria";

export interface Rule {
  id: RuleId;
  label: string;
  /** Veces por semana (7 días). Se escala si el menú tiene menos días. */
  min?: number;
  max?: number;
  /** ¿Cuenta este plato para la regla? */
  counts: (f: NutritionFlags) => boolean;
  advice: { low?: string; high?: string };
}

export const RULES: Rule[] = [
  {
    id: "legumbre",
    label: "Legumbres",
    min: 3,
    max: 4,
    counts: (f) => f.category === "legumbre",
    advice: { low: "Añade más legumbres: lentejas, garbanzos, alubias (3–4 veces por semana).", high: "Demasiadas legumbres: alterna con verdura, pasta o arroz." },
  },
  {
    id: "pescado",
    label: "Pescado",
    min: 3,
    max: 4,
    counts: (f) => f.category === "pescado",
    advice: { low: "Faltan platos de pescado: lo recomendado son 3–4 a la semana.", high: "Mucho pescado esta semana: puedes cambiar alguno por huevo o legumbre." },
  },
  {
    id: "pescado_azul",
    label: "Pescado azul",
    min: 1,
    counts: (f) => f.oilyFish,
    advice: { low: "Incluye pescado azul 1–2 veces: salmón, sardinas, caballa, boquerones, bonito (añade alguna receta)." },
  },
  {
    id: "huevo",
    label: "Huevos",
    min: 2,
    max: 4,
    counts: (f) => f.category === "huevo",
    advice: { low: "Incluye huevo 2–4 veces: tortilla, revuelto, huevos rellenos…", high: "Muchos platos de huevo: sustituye alguno por pescado o legumbre." },
  },
  {
    id: "carne",
    label: "Carne",
    max: 4,
    counts: (f) => f.category === "carne",
    advice: { high: "Demasiada carne: lo recomendado son 3–4 veces, mejor blanca (pollo, pavo, conejo)." },
  },
  {
    id: "carne_roja",
    label: "Carne roja",
    max: 2,
    counts: (f) => f.meat === "roja",
    advice: { high: "Mucha carne roja (ternera, cerdo, cordero): mejor 1–2 veces por semana." },
  },
  {
    id: "procesada",
    label: "Carne procesada",
    max: 2,
    counts: (f) => f.processedMeat,
    advice: { high: "Muchos platos con embutidos o carne procesada (chorizo, bacon, salchichas…): mejor ocasionalmente." },
  },
  {
    id: "fritos",
    label: "Fritos y rebozados",
    max: 2,
    counts: (f) => f.fried,
    advice: { high: "Muchos fritos o rebozados: prueba la plancha o el horno en alguno." },
  },
  {
    id: "rapida",
    label: "Comida rápida",
    max: 2,
    counts: (f) => f.fastFood,
    advice: { high: "Mucha comida rápida (pizza, nuggets, hamburguesas…): mejor ocasional." },
  },
  {
    id: "verdura_diaria",
    label: "Verdura cada día",
    counts: (f) => f.vegetables,
    advice: { low: "Hay días sin verdura: añade un primero de verdura o acompaña con ensalada." },
  },
];

export interface DishForBalance {
  date: string;
  meal: "comida" | "cena";
  flags: NutritionFlags;
}

export interface RuleStatus {
  id: RuleId;
  label: string;
  count: number;
  min?: number;
  max?: number;
  status: "ok" | "bajo" | "alto";
  advice: string | null;
}

/** Objetivos escalados a los días del menú (un menú de 7 días usa los valores tal cual). */
export function scaledLimits(rule: Rule, days: number): { min?: number; max?: number } {
  const k = days / 7;
  return {
    min: rule.min === undefined ? undefined : Math.max(rule.min > 0 ? 1 : 0, Math.round(rule.min * k)),
    max: rule.max === undefined ? undefined : Math.max(1, Math.round(rule.max * k)),
  };
}

/** Evaluación de la semana frente a las recomendaciones. */
export function weeklyBalance(dishes: DishForBalance[]): RuleStatus[] {
  const days = new Set(dishes.map((d) => d.date));
  const nDays = Math.max(1, days.size);

  return RULES.map((rule) => {
    if (rule.id === "verdura_diaria") {
      const withVeg = new Set(dishes.filter((d) => d.flags.vegetables).map((d) => d.date));
      const missing = [...days].filter((d) => !withVeg.has(d)).length;
      return {
        id: rule.id,
        label: rule.label,
        count: withVeg.size,
        min: days.size,
        status: missing > 0 ? "bajo" : "ok",
        advice: missing > 0 ? rule.advice.low! : null,
      };
    }
    const { min, max } = scaledLimits(rule, nDays);
    const count = dishes.filter((d) => rule.counts(d.flags)).length;
    const status = min !== undefined && count < min ? "bajo" : max !== undefined && count > max ? "alto" : "ok";
    return {
      id: rule.id,
      label: rule.label,
      count,
      min,
      max,
      status,
      advice: status === "bajo" ? (rule.advice.low ?? null) : status === "alto" ? (rule.advice.high ?? null) : null,
    };
  });
}
