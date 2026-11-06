/**
 * Generador del menú semanal (sin IA, determinista con semilla).
 *
 * Rellena huecos (día + comida/cena) eligiendo, para cada uno, la receta con
 * mejor puntuación según variedad, equilibrio, tiempo, restricciones y gustos.
 * Los huecos "fijos" (bloqueados o elegidos a mano) se respetan y cuentan
 * para el equilibrio.
 */
import { ingredientMatches } from "./matching";
import { classifyRecipe, hasMeatOrFish, type Category, type Meal, type PlanParams } from "./menu";
import { totalMinutes } from "./recipe";

export interface PlannerRecipe {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  isFavorite: boolean;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: { name: string }[];
}

export interface PlannerSlot {
  date: string;
  meal: Meal;
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

/** Raciones objetivo por tipo en una semana de 14 platos (se escala). */
const TARGETS: Record<Category, { min: number; max: number }> = {
  legumbre: { min: 2, max: 4 },
  pescado: { min: 2, max: 4 },
  carne: { min: 1, max: 4 },
  huevo: { min: 1, max: 3 },
  pasta_arroz: { min: 0, max: 3 },
  verdura: { min: 2, max: 14 },
};

const CHEAP: Category[] = ["legumbre", "huevo", "pasta_arroz", "verdura"];

/** Recetas permitidas por las restricciones (vegetariano, ingredientes a evitar). */
export function allowedRecipes<R extends PlannerRecipe>(recipes: R[], params: PlanParams): R[] {
  return recipes.filter((r) => {
    if (r.ingredients.length === 0) return false; // sin ingredientes no sabemos qué es
    if (params.vegetarian && hasMeatOrFish(r)) return false;
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
  const scale = ctx.slots.length / 14;
  let s = 0;

  // Equilibrio semanal
  const count = ctx.assignments.filter((id, i) => i !== index && id && ctx.categories.get(id) === cat).length;
  const target = TARGETS[cat];
  if (count < Math.round(target.min * scale)) s += 3;
  if (count >= Math.max(1, Math.round(target.max * scale))) s -= 6;

  // Variedad: mismo tipo el mismo día o en el hueco anterior/siguiente
  ctx.slots.forEach((other, i) => {
    const id = ctx.assignments[i];
    if (i === index || !id || ctx.categories.get(id) !== cat) return;
    if (other.date === slot.date) s -= 4;
    else if (Math.abs(i - index) === 1) s -= 3;
  });

  // Comida vs cena
  const heavy = cat === "legumbre" || r.tags.includes("cuchara");
  if (slot.meal === "cena") {
    if (isLight(r, cat)) s += 2;
    if (heavy) s -= 3;
  } else if (heavy) {
    s += 1;
  }

  // Tiempo: entre semana mejor rápido
  const total = totalMinutes(r);
  if (!slot.weekend && total !== null && total > 45) s -= 1;

  // No repetir lo reciente
  const ago = ctx.recent.get(r.id);
  if (ago !== undefined) s -= ago <= 7 ? 5 : ago <= 14 ? 2 : 0;

  // Gustos
  s += ((r.rating ?? 3) - 3) * 0.8;
  if (r.isFavorite) s += 1;
  if (r.tags.includes("aprovechamiento")) s += 0.5;

  // Presupuesto
  if (ctx.params.budget === "economico") s += CHEAP.includes(cat) ? 1.5 : -1;

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
  const used = new Set(ctx.assignments.filter((id, i) => i !== index && id) as string[]);
  const fitting = ctx.recipes.filter((r) => fitsTime(r, slot, ctx.params) && !exclude.has(r.id));

  // 1ª opción: recetas no usadas esta semana. Si no quedan, se permite repetir.
  for (const pool of [fitting.filter((r) => !used.has(r.id)), fitting]) {
    if (pool.length === 0) continue;
    let best: { id: string; s: number } | null = null;
    for (const r of pool) {
      const s = score(r, index, ctx) - (used.has(r.id) ? 20 : 0);
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
  return warnings;
}
