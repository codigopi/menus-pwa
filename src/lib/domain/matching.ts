/**
 * "¿Qué cocino con lo que tengo?": emparejamiento de ingredientes en español.
 *
 * Idea clave: en español el núcleo del ingrediente es la primera palabra
 * ("caldo de pollo" es un caldo; "pimiento rojo" es un pimiento). Comparamos
 * núcleos normalizados (sin tildes, en singular, con sinónimos). Para cortes
 * de carne/pescado ("pechuga de pollo") el animal también cuenta como núcleo,
 * así quien tiene "pollo" encuentra recetas con pechuga.
 *
 * Todo es puro y determinista (sin IA), por eso funciona sin clave.
 */

const STOPWORDS = new Set(["de", "del", "la", "las", "el", "los", "en", "con", "y", "o", "para", "al", "a", "un", "una", "unos", "unas"]);

/** Cortes: "X de <animal>" también cuenta como <animal>. */
const CUTS = new Set([
  "pechuga", "muslo", "contramuslo", "alita", "ala", "filete", "lomo", "solomillo", "costilla", "chuleta",
  "carrillada", "jarrete", "paletilla", "pierna", "carne", "lomito", "lomos", "tajada", "rodaja", "trozo", "taco",
]);

/** Sinónimos y variantes regionales → forma canónica. */
const SYNONYMS: Record<string, string> = {
  papa: "patata",
  aove: "aceite",
  jitomate: "tomate",
  frijol: "alubia",
  poroto: "alubia",
  judion: "alubia",
  habichuela: "alubia",
  garbanzo: "garbanzo",
  zapallo: "calabaza",
  palta: "aguacate",
  choclo: "maiz",
  arveja: "guisante",
  chicharo: "guisante",
  cebolleta: "cebolleta",
  calabacin: "calabacin",
  langostino: "langostino",
  gamba: "gamba",
};

/** Quita tildes y pasa a minúsculas ("Champiñón" → "champinon"). */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Singular aproximado de una palabra española ya sin tildes. */
export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ces")) return `${w.slice(0, -3)}z`; // nueces → nuez
  // Plurales en -es tras consonante: limones → limon, panes → pan.
  // (No tras "d": "verdes"/"grandes" son plurales de "verde"/"grande".)
  if (w.endsWith("es") && /[lnrjsy]$/.test(w.slice(0, -2)) && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1); // tomates → tomate
  return w;
}

/** Palabras significativas normalizadas de un nombre de ingrediente. */
export function tokens(name: string): string[] {
  return fold(name)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[singular(t)] ?? singular(t));
}

/** Núcleos que representan al ingrediente (normalmente uno). */
export function heads(name: string): string[] {
  const t = tokens(name);
  if (t.length === 0) return [];
  const result = [t[0]];
  // "pechuga de pollo" → también "pollo"
  if (CUTS.has(t[0]) && t[1]) result.push(t[1]);
  return result;
}

/** ¿El ingrediente que tengo (`have`) sirve para el que pide la receta (`need`)? */
export function ingredientMatches(have: string, need: string): boolean {
  const h = heads(have);
  const n = heads(need);
  return h.some((x) => n.includes(x));
}

export const DEFAULT_STAPLES = ["agua", "sal", "aceite de oliva", "pimienta"];

export interface MatchableRecipe {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null }[];
  /** Encaje con los gustos de la casa (opcional). */
  taste?: number;
}

export interface RecipeMatch<R extends MatchableRecipe = MatchableRecipe> {
  recipe: R;
  /** Ingredientes míos que usa (tal y como los escribí). */
  used: string[];
  /** Ingredientes principales que me faltan. */
  missing: string[];
  /** Faltas menores: "al gusto" u opcionales. */
  missingMinor: string[];
}

/** Ingredientes "menores": al gusto (sin cantidad ni unidad) u opcionales. */
function isMinor(ing: MatchableRecipe["ingredients"][number]): boolean {
  return (ing.quantity === null && ing.unit === null) || /opcional/i.test(ing.note ?? "");
}

/**
 * Busca recetas que usan lo que tengo y dice qué falta.
 * Orden: menos faltas → más ingredientes míos aprovechados → etiqueta
 * "aprovechamiento" → mejor valoradas.
 */
export function matchRecipes<R extends MatchableRecipe>(recipes: R[], have: string[], staples: string[] = DEFAULT_STAPLES): RecipeMatch<R>[] {
  const mine = have.map((h) => h.trim()).filter(Boolean);
  if (mine.length === 0) return [];

  const results: RecipeMatch<R>[] = [];
  for (const recipe of recipes) {
    const used = new Set<string>();
    const missing: string[] = [];
    const missingMinor: string[] = [];

    for (const ing of recipe.ingredients) {
      const myMatch = mine.find((m) => ingredientMatches(m, ing.name));
      if (myMatch) {
        used.add(myMatch);
        continue;
      }
      if (staples.some((s) => ingredientMatches(s, ing.name))) continue;
      (isMinor(ing) ? missingMinor : missing).push(ing.name);
    }

    if (used.size > 0) {
      results.push({ recipe, used: [...used], missing: dedupe(missing), missingMinor: dedupe(missingMinor) });
    }
  }

  const leftovers = (r: R) => (r.tags.includes("aprovechamiento") ? 1 : 0);
  return results.sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      b.used.length - a.used.length ||
      leftovers(b.recipe) - leftovers(a.recipe) ||
      (b.recipe.taste ?? 0) - (a.recipe.taste ?? 0) ||
      (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0) ||
      a.recipe.title.localeCompare(b.recipe.title, "es"),
  );
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((n) => {
    const k = heads(n).join("|") || fold(n);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Ingredientes frecuentes para autocompletar cuando la biblioteca es pequeña. */
export const COMMON_INGREDIENTS = [
  "huevo", "patata", "cebolla", "ajo", "tomate", "pimiento", "calabacín", "berenjena", "zanahoria", "puerro",
  "espinacas", "acelgas", "champiñones", "calabaza", "brócoli", "coliflor", "judías verdes", "guisantes", "lechuga", "pepino",
  "pollo", "carne picada", "cerdo", "ternera", "chorizo", "jamón", "bacon", "salchichas", "merluza", "bacalao",
  "salmón", "atún", "sardinas", "gambas", "mejillones", "calamares", "lentejas", "garbanzos", "alubias", "arroz",
  "pasta", "macarrones", "espaguetis", "fideos", "pan", "harina", "leche", "nata", "queso", "mantequilla",
  "yogur", "limón", "naranja", "manzana", "plátano", "perejil", "laurel", "pimentón", "comino", "caldo",
];
