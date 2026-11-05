/**
 * Catálogo de unidades de cocina en español.
 *
 * Cada unidad pertenece a una "dimensión":
 *  - mass:   se puede convertir a gramos (factor = gramos por unidad)
 *  - volume: se puede convertir a mililitros (factor = ml por unidad)
 *  - count:  piezas contables (diente, lata...). Solo convertible a masa si el
 *            ingrediente conoce su peso por unidad (se resolverá en la Fase 5).
 *  - vague:  medidas imprecisas (pizca, chorrito). Nunca se convierten ni suman.
 */

export type UnitDimension = "mass" | "volume" | "count" | "vague";

export interface UnitDef {
  key: string;
  /** Texto para cantidad = 1 */
  singular: string;
  /** Texto para cantidad != 1 (en abreviaturas coincide con singular) */
  plural: string;
  dimension: UnitDimension;
  /** Factor a la unidad base de su dimensión (g o ml). 1 para count/vague. */
  factor: number;
  /** Formas alternativas que se reconocen al normalizar texto libre. */
  aliases: string[];
}

export const UNITS = [
  // Masa
  { key: "g", singular: "g", plural: "g", dimension: "mass", factor: 1, aliases: ["gr", "grs", "gramo", "gramos"] },
  { key: "kg", singular: "kg", plural: "kg", dimension: "mass", factor: 1000, aliases: ["kilo", "kilos", "kilogramo", "kilogramos"] },
  // Volumen
  { key: "ml", singular: "ml", plural: "ml", dimension: "volume", factor: 1, aliases: ["mililitro", "mililitros", "cc"] },
  { key: "cl", singular: "cl", plural: "cl", dimension: "volume", factor: 10, aliases: ["centilitro", "centilitros"] },
  { key: "l", singular: "l", plural: "l", dimension: "volume", factor: 1000, aliases: ["lt", "litro", "litros"] },
  { key: "cda", singular: "cda", plural: "cdas", dimension: "volume", factor: 15, aliases: ["cucharada", "cucharadas", "c/s", "cs", "tbsp"] },
  { key: "cdta", singular: "cdta", plural: "cdtas", dimension: "volume", factor: 5, aliases: ["cucharadita", "cucharaditas", "c/c", "cc.", "tsp"] },
  { key: "taza", singular: "taza", plural: "tazas", dimension: "volume", factor: 240, aliases: ["cup", "cups"] },
  { key: "vaso", singular: "vaso", plural: "vasos", dimension: "volume", factor: 200, aliases: [] },
  // Contables
  { key: "ud", singular: "ud", plural: "uds", dimension: "count", factor: 1, aliases: ["u", "unidad", "unidades", "pieza", "piezas"] },
  { key: "diente", singular: "diente", plural: "dientes", dimension: "count", factor: 1, aliases: [] },
  { key: "lata", singular: "lata", plural: "latas", dimension: "count", factor: 1, aliases: [] },
  { key: "bote", singular: "bote", plural: "botes", dimension: "count", factor: 1, aliases: ["tarro", "tarros"] },
  { key: "sobre", singular: "sobre", plural: "sobres", dimension: "count", factor: 1, aliases: [] },
  { key: "paquete", singular: "paquete", plural: "paquetes", dimension: "count", factor: 1, aliases: [] },
  { key: "manojo", singular: "manojo", plural: "manojos", dimension: "count", factor: 1, aliases: ["ramillete"] },
  { key: "rama", singular: "rama", plural: "ramas", dimension: "count", factor: 1, aliases: ["ramita", "ramitas"] },
  { key: "hoja", singular: "hoja", plural: "hojas", dimension: "count", factor: 1, aliases: [] },
  { key: "rebanada", singular: "rebanada", plural: "rebanadas", dimension: "count", factor: 1, aliases: [] },
  { key: "loncha", singular: "loncha", plural: "lonchas", dimension: "count", factor: 1, aliases: ["lonchas"] },
  { key: "filete", singular: "filete", plural: "filetes", dimension: "count", factor: 1, aliases: [] },
  // Imprecisas
  { key: "pizca", singular: "pizca", plural: "pizcas", dimension: "vague", factor: 1, aliases: ["pellizco"] },
  { key: "chorrito", singular: "chorrito", plural: "chorritos", dimension: "vague", factor: 1, aliases: ["chorro", "chorros"] },
  { key: "puñado", singular: "puñado", plural: "puñados", dimension: "vague", factor: 1, aliases: ["punado"] },
] as const satisfies readonly UnitDef[];

export type UnitKey = (typeof UNITS)[number]["key"];

export const UNIT_KEYS = UNITS.map((u) => u.key) as [UnitKey, ...UnitKey[]];

const BY_KEY = new Map<string, UnitDef>(UNITS.map((u) => [u.key, u]));

/** Índice de alias → clave, construido una vez. Incluye singular, plural y clave. */
const ALIAS_INDEX = new Map<string, UnitKey>();
for (const u of UNITS as readonly UnitDef[]) {
  for (const form of [u.key, u.singular, u.plural, ...u.aliases]) {
    ALIAS_INDEX.set(form.toLowerCase(), u.key as UnitKey);
  }
}

export function getUnit(key: string | null | undefined): UnitDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

/**
 * Convierte texto libre ("Cucharadas", "gr.", "c/s") en una clave de unidad.
 * Devuelve null si no se reconoce (p. ej. "al gusto" o texto vacío).
 */
export function normalizeUnit(raw: string | null | undefined): UnitKey | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  return ALIAS_INDEX.get(cleaned) ?? ALIAS_INDEX.get(cleaned.replace(/\.$/, "")) ?? null;
}

/** Etiqueta de la unidad concordando en número con la cantidad. */
export function unitLabel(key: string | null | undefined, quantity: number | null): string {
  const unit = getUnit(key);
  if (!unit) return "";
  return quantity !== null && quantity > 1 ? unit.plural : unit.singular;
}

/** Opciones agrupadas para selectores de UI. */
export const UNIT_GROUPS: { label: string; dimension: UnitDimension }[] = [
  { label: "Peso", dimension: "mass" },
  { label: "Volumen", dimension: "volume" },
  { label: "Unidades", dimension: "count" },
  { label: "A ojo", dimension: "vague" },
];
