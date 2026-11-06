/**
 * Generador del menú semanal (sin IA, determinista con semilla).
 *
 * Rellena huecos (día + comida/cena) eligiendo, para cada uno, la receta con
 * mejor puntuación según variedad, equilibrio, tiempo, restricciones y gustos.
 * Los huecos "fijos" (bloqueados o elegidos a mano) se respetan y cuentan
 * para el equilibrio.
 */
import { ingredientMatches } from "./matching";
import { classifyRecipe, courseRole, fitsMeal, hasMeatOrFish, isWholeMeal, type Category, type Course, type Meal, type PlanParams } from "./menu";
import { nutritionFlags, RULES, scaledLimits, type NutritionFlags, type Rule } from "./nutrition";
import { totalMinutes } from "./recipe";

export interface PlannerRecipe {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  isFavorite: boolean;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: { name: string; note?: string | null }[];
  /** Coste orientativo por ración en € (null si no se puede estimar). */
  costPerServing?: number | null;
  /** Encaje con los gustos de la casa (-2…+2), aprendido del histórico. */
  taste?: number;
}

export interface PlannerSlot {
  date: string;
  meal: Meal;
  /** Primero, segundo o plato único (por defecto, plato único). */
  course?: Course;
  weekend: boolean;
  /** Receta fija (bloqueada/elegida a mano). `undefined` = hueco a rellenar. */
  fixed?: string | null;
}

export interface PlanInput {
  recipes: PlannerRecipe[];
  slots: PlannerSlot[];
  params: PlanParams;
  /** recipeId → días desde la última vez que estuvo en un menú (para no repetir). */
  recent?: Map<string, number>;
  /** Menú anterior de esta misma semana (al regenerar), alineado con `slots`. */
  previous?: (string | null)[];
  seed?: number;
}

export interface PlanResult {
  /** Una receta (o null si no hay candidatas) por hueco, en el mismo orden. */
  assignments: (string | null)[];
  warnings: string[];
}

/** Generador pseudoaleatorio pequeño y reproducible (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHEAP: Category[] = ["legumbre", "huevo", "pasta_arroz", "verdura"];

/** Lo que resta cada repetición de un plato en la misma semana. */
const REPEAT_PENALTY = 9;

/**
 * Platos propuestos por la app (etiqueta "sugerida"): solo entran si cubren
 * algo que la pirámide pide y los platos de siempre no. Dejan de restar en
 * cuanto la familia los adopta (favorito, valoración o quitando la etiqueta).
 */
export const SUGGESTED_TAG = "sugerida";
const SUGGESTED_PENALTY = 2.5;

function isUnadoptedSuggestion(r: PlannerRecipe): boolean {
  return r.tags.includes(SUGGESTED_TAG) && !r.isFavorite && r.rating === null;
}

/** Ingrediente principal ("garbanzos cocidos" → "garbanzo") para no repetirlo en la semana. */
export function mainIngredient(r: Pick<PlannerRecipe, "ingredients">): string | null {
  const first = r.ingredients[0]?.name.trim().toLowerCase().split(/\s+/)[0];
  return first ? first.replace(/s$/, "") : null;
}

/** Recetas permitidas por las restricciones (vegetariano, ingredientes a evitar). */
export function allowedRecipes<R extends PlannerRecipe>(recipes: R[], params: PlanParams): R[] {
  return recipes.filter((r) => {
    if (r.ingredients.length === 0) return false; // sin ingredientes no sabemos qué es
    if (r.tags.includes("postre")) return false; // los postres no son comida ni cena
    if (params.vegetarian && hasMeatOrFish(r)) return false;
    // Con niños: nada de pescados con mucho mercurio (recomendación AESAN)
    if (params.children > 0 && nutritionFlags(r).highMercury) return false;
    if (params.avoid.some((a) => r.ingredients.some((i) => ingredientMatches(a, i.name)))) return false;
    return true;
  });
}

function fitsTime(r: PlannerRecipe, slot: PlannerSlot, params: PlanParams): boolean {
  const limit = slot.weekend ? params.maxMinutesWeekend : params.maxMinutesWeekday;
  const total = totalMinutes(r);
  return limit === null || total === null || total <= limit;
}

function isLight(r: PlannerRecipe, cat: Category): boolean {
  const total = totalMinutes(r);
  return r.tags.includes("cena ligera") || cat === "verdura" || cat === "huevo" || cat === "pescado" || (total !== null && total <= 25);
}

interface Context {
  recipes: PlannerRecipe[];
  categories: Map<string, Category>;
  flags: Map<string, NutritionFlags>;
  /** Límites de la pirámide escalados a los días de este menú. */
  limits: { rule: Rule; min?: number; max?: number }[];
  roles: Map<string, Course>;
  mains: Map<string, string | null>;
  wholeMeals: Set<string>;
  slots: PlannerSlot[];
  assignments: (string | null)[];
  params: PlanParams;
  recent: Map<string, number>;
  previous: (string | null)[];
  previousSet: Set<string>;
  random: () => number;
}

function score(r: PlannerRecipe, index: number, ctx: Context): number {
  const slot = ctx.slots[index];
  const cat = ctx.categories.get(r.id)!;
  const flags = ctx.flags.get(r.id)!;
  let s = 0;

  // Pirámide nutricional: lo que aún falta suma; pasarse de lo recomendado resta
  for (const { rule, min, max } of ctx.limits) {
    if (!rule.counts(flags)) continue;
    const count = ctx.assignments.filter((id, i) => i !== index && id && rule.counts(ctx.flags.get(id)!)).length;
    if (min !== undefined && count < min) s += rule.id === "pescado_azul" ? 2 : 3;
    // Pasarse resta, y más cuanto más se pasa
    if (max !== undefined && count + 1 > max) s -= 8 * (count + 1 - max);
  }

  // Verdura todos los días (en comida y cena)
  if (flags.vegetables) {
    const dayHasVeg = ctx.slots.some((o, i) => i !== index && o.date === slot.date && ctx.assignments[i] && ctx.flags.get(ctx.assignments[i]!)!.vegetables);
    s += dayHasVeg ? 0.5 : 2.5;
    if (slot.meal === "cena") s += 0.5;
  }

  // Variedad: mismo tipo el mismo día o en el hueco anterior/siguiente
  ctx.slots.forEach((other, i) => {
    const id = ctx.assignments[i];
    if (i === index || !id || ctx.categories.get(id) !== cat) return;
    if (other.date === slot.date) s -= 4;
    else if (Math.abs(i - index) === 1) s -= 3;
  });

  // Mismo ingrediente principal en otro plato de la semana (tres de garbanzos, no).
  // Los huevos no: ya tienen su propio rango en la pirámide.
  const main = ctx.mains.get(r.id);
  if (main && main !== "huevo") {
    s -= 2 * ctx.assignments.filter((id, i) => i !== index && id && id !== r.id && ctx.mains.get(id) === main).length;
  }

  // Comida vs cena
  const heavy = cat === "legumbre" || r.tags.includes("cuchara");
  if (slot.meal === "cena") {
    if (isLight(r, cat)) s += 2;
    if (heavy) s -= 3;
  } else if (heavy) {
    s += 1;
  }

  // Comida de plato único: mejor un plato completo (cocido, lentejas con chorizo…)
  if (slot.meal === "comida" && (slot.course ?? "unico") === "unico" && ctx.wholeMeals.has(r.id)) s += 2;

  // Tiempo: solo si la familia ha puesto un límite entre semana, mejor lo rápido
  const total = totalMinutes(r);
  if (!slot.weekend && ctx.params.maxMinutesWeekday !== null && total !== null && total > 45) s -= 1;

  // No repetir lo reciente
  const ago = ctx.recent.get(r.id);
  if (ago !== undefined) s -= ago <= 7 ? 5 : ago <= 14 ? 2 : 0;

  // Gustos
  s += ((r.rating ?? 3) - 3) * 0.8;
  if (r.isFavorite) s += 1;
  if (r.tags.includes("aprovechamiento")) s += 0.5;
  // Primero los platos de la casa; los sugeridos, para completar
  if (isUnadoptedSuggestion(r)) s -= SUGGESTED_PENALTY;
  s += (r.taste ?? 0) * 0.8;

  // Presupuesto: con precio estimado, cuanto más barata la ración mejor
  // (≈2 €/ración es neutro); sin precio, por tipo de plato.
  if (ctx.params.budget === "economico") {
    const cps = r.costPerServing;
    s += cps != null ? Math.max(-3, Math.min(2, 2 - cps)) : CHEAP.includes(cat) ? 1.5 : -1;
  }

  // Al regenerar: que cambie de verdad (no el mismo plato en el mismo hueco,
  // y mejor recetas que no estaban en el menú anterior).
  if (ctx.previous[index] === r.id) s -= 6;
  else if (ctx.previousSet.has(r.id)) s -= 1.5;

  // Un poco de azar para que cada generación sea distinta
  return s + ctx.random() * 1.5;
}

/** Mejor receta para un hueco, dadas las demás asignaciones. */
function pick(index: number, ctx: Context, exclude: Set<string>): string | null {
  const slot = ctx.slots[index];
  const usable = ctx.recipes.filter((r) => fitsTime(r, slot, ctx.params) && !exclude.has(r.id));
  // Etiquetas "comida"/"cena": recetas exclusivas de una comida (si queda alguna)
  const forMeal = usable.filter((r) => fitsMeal(r, slot.meal));
  const available = forMeal.length > 0 ? forMeal : usable;
  // Primero/segundo: recetas de ese papel; si no hay ninguna, cualquiera (mejor algo que nada)
  const course = slot.course ?? "unico";
  const byRole = course === "unico" ? available : available.filter((r) => ctx.roles.get(r.id) === course);
  const fitting = byRole.length > 0 ? byRole : available;

  // Repetir un plato en la semana resta (más cuanto más se repite), pero no
  // está prohibido: es mejor repetir una merluza que pasarse de embutidos.
  const usedCount = new Map<string, number>();
  ctx.assignments.forEach((id, i) => {
    if (i !== index && id) usedCount.set(id, (usedCount.get(id) ?? 0) + 1);
  });
  // Reglas de la pirámide que aún no llegan al mínimo esta semana
  const unmet = ctx.limits.filter(
    ({ rule, min }) => min !== undefined && ctx.assignments.filter((id, i) => i !== index && id && rule.counts(ctx.flags.get(id)!)).length < min,
  );
  const repeatPenalty = (id: string) => {
    const n = usedCount.get(id) ?? 0;
    const sameDay = ctx.slots.some((o, i) => i !== index && o.date === slot.date && ctx.assignments[i] === id);
    if (sameDay) return 50; // el mismo plato dos veces el mismo día, nunca
    // Repetir para llegar a un mínimo (p. ej. lentejas dos veces para cumplir
    // las legumbres) cuesta poco; repetir por repetir, bastante.
    const helps = unmet.some(({ rule }) => rule.counts(ctx.flags.get(id)!));
    return n * (helps ? REPEAT_PENALTY / 3 : REPEAT_PENALTY);
  };

  // En la cena, antes que un plato contundente (cocido, lentejas…) es mejor algo ligero.
  const heavyAtNight = (r: PlannerRecipe) =>
    ctx.categories.get(r.id) === "legumbre" || r.tags.includes("cuchara") || ctx.wholeMeals.has(r.id);
  const pools = slot.meal === "cena" ? [fitting.filter((r) => !heavyAtNight(r)), fitting] : [fitting];
  for (const pool of pools) {
    if (pool.length === 0) continue;
    let best: { id: string; s: number } | null = null;
    for (const r of pool) {
      const s = score(r, index, ctx) - repeatPenalty(r.id);
      if (!best || s > best.s) best = { id: r.id, s };
    }
    return best!.id;
  }
  return null;
}

function buildContext(input: PlanInput, assignments: (string | null)[]): Context {
  const recipes = allowedRecipes(input.recipes, input.params);
  return {
    recipes,
    categories: new Map(input.recipes.map((r) => [r.id, classifyRecipe(r)])),
    flags: new Map(input.recipes.map((r) => [r.id, nutritionFlags(r)])),
    limits: RULES.filter((rule) => rule.id !== "verdura_diaria").map((rule) => ({ rule, ...scaledLimits(rule, new Set(input.slots.map((sl) => sl.date)).size || 7) })),
    roles: new Map(input.recipes.map((r) => [r.id, courseRole(r)])),
    mains: new Map(input.recipes.map((r) => [r.id, mainIngredient(r)])),
    wholeMeals: new Set(input.recipes.filter(isWholeMeal).map((r) => r.id)),
    slots: input.slots,
    assignments,
    params: input.params,
    recent: input.recent ?? new Map(),
    previous: input.previous ?? [],
    previousSet: new Set((input.previous ?? []).filter((id): id is string => !!id)),
    random: rng(input.seed ?? 1),
  };
}

/** Genera (o regenera) la semana respetando los huecos fijos. */
export function planWeek(input: PlanInput): PlanResult {
  const assignments: (string | null)[] = input.slots.map((s) => (s.fixed === undefined ? null : s.fixed));
  const ctx = buildContext(input, assignments);

  input.slots.forEach((slot, i) => {
    if (slot.fixed !== undefined) return;
    assignments[i] = pick(i, ctx, new Set());
  });

  return { assignments, warnings: planWarnings(input, ctx) };
}

/** Elige otra receta para un hueco concreto (distinta de la actual). */
export function replanSlot(input: PlanInput, current: (string | null)[], index: number): string | null {
  const assignments = [...current];
  const ctx = buildContext(input, assignments);
  const exclude = new Set(current[index] ? [current[index]!] : []);
  return pick(index, ctx, exclude) ?? current[index];
}

/** Avisos sobre un menú ya hecho (p. ej. al volver a abrirlo). */
export function warningsFor(input: PlanInput, assignments: (string | null)[]): string[] {
  return planWarnings(input, buildContext(input, assignments));
}

function planWarnings(input: PlanInput, ctx: Context): string[] {
  const warnings: string[] = [];
  const filled = ctx.assignments.filter(Boolean).length;
  const unique = new Set(ctx.assignments.filter(Boolean)).size;

  if (ctx.recipes.length === 0) {
    warnings.push(
      input.recipes.length === 0
        ? "Aún no tienes recetas: importa o escribe algunas para generar el menú."
        : "Ninguna receta cumple las restricciones actuales.",
    );
    return warnings;
  }
  // Huecos fijos vacíos ("Comer fuera") no cuentan como problema.
  const expected = input.slots.filter((s, i) => s.fixed === undefined || ctx.assignments[i]).length;
  if (filled < expected) warnings.push("Algunos huecos se han quedado vacíos: no hay recetas que encajen con el tiempo disponible.");
  if (unique < filled) warnings.push(`Se repiten platos: tu biblioteca tiene pocas recetas para ${input.slots.length} comidas.`);

  const available = new Set(ctx.recipes.map((r) => ctx.categories.get(r.id)));
  if (!available.has("pescado") && !input.params.vegetarian) warnings.push("No tienes recetas de pescado: añade alguna para equilibrar la semana.");
  if (!available.has("legumbre")) warnings.push("No tienes recetas de legumbres: añade alguna para equilibrar la semana.");
  // Legumbres que no caben entre semana por tiempo: la pirámide pide 3–4
  const weekdayMax = input.params.maxMinutesWeekday;
  const legumes = ctx.recipes.filter((r) => ctx.categories.get(r.id) === "legumbre");
  if (weekdayMax !== null && legumes.length > 0 && legumes.every((r) => (totalMinutes(r) ?? 0) > weekdayMax)) {
    warnings.push(
      `Tus legumbres tardan más de ${weekdayMax} min y solo caben el fin de semana. Para llegar a 3–4 a la semana: sube el tiempo «entre semana» en Ajustes, hazlas en olla exprés (y ajusta el tiempo de la receta) o usa legumbre cocida de bote.`,
    );
  }
  const courses = new Set(input.slots.map((s) => s.course ?? "unico"));
  const roles = new Set(ctx.recipes.map((r) => ctx.roles.get(r.id)));
  if (courses.has("primero") && !roles.has("primero")) warnings.push("No tienes recetas de primero (legumbres, verduras, cremas, pasta, arroz): se usan otras.");
  if (courses.has("segundo") && !roles.has("segundo")) warnings.push("No tienes recetas de segundo (carne, pescado, huevos): se usan otras.");
  return warnings;
}
