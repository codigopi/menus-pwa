/**
 * Lista de la compra: fusión de ingredientes y unidades, resta de la
 * despensa, redondeo "para comprar" y coste orientativo. Todo puro.
 *
 * Cantidades internas por dimensión:
 *   g  (masa)   ·  ml (volumen)  ·  counts (piezas por unidad: ud, diente, lata…)
 * Con el peso por unidad del catálogo se pasa de piezas a gramos (o al revés)
 * según cómo se compre el producto (patatas al peso, cebollas por unidades).
 */
import { findCatalog, sectionFor, SECTIONS, type CatalogEntry, type Section } from "./catalog";
import { parseIngredientLine } from "./ingredient-parser";
import { ingredientMatches, tokens } from "./matching";
import { formatQuantity } from "./quantity";
import { getUnit, unitLabel } from "./units";

export interface NeedLine {
  name: string;
  quantity: number | null;
  unit: string | null;
  /** De qué receta viene (para mostrarlo). */
  source?: string;
}

export interface PantryLine {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface Amounts {
  g: number;
  ml: number;
  counts: Record<string, number>;
  /** Alguna línea era "al gusto"/pizca/chorrito. */
  toTaste: boolean;
}

export interface ShoppingEntry {
  key: string;
  name: string;
  section: Section;
  /** Texto para comprar: "350 g", "2 uds + 1 lata". Vacío = al gusto. */
  amount: string;
  toTaste: boolean;
  sources: string[];
  /** Coste orientativo en euros (null si no se puede estimar). */
  cost: number | null;
  /** "Tienes 200 g" si la despensa cubre una parte. */
  pantryNote: string | null;
}

export interface ShoppingResult {
  items: ShoppingEntry[];
  /** Lo que no hace falta comprar porque ya está en la despensa. */
  covered: { key: string; name: string; amount: string }[];
}

// ---------------------------------------------------------------- claves

/** Palabras de preparación/tamaño que no cambian lo que se compra. */
const DROP = new Set([
  "picado", "picada", "troceado", "troceada", "laminado", "laminada", "cortado", "cortada", "pelado", "pelada",
  "fresco", "fresca", "grande", "mediano", "mediana", "pequeno", "pequena", "maduro", "madura", "entero", "entera",
  "fino", "fina", "dado", "tira", "rodaja", "trozo", "l", "m", "xl", "s", "aprox", "bien", "muy",
]);

/** Productos que se fusionan aunque la receta los describa distinto. */
const MERGE_BY_ENTRY = new Set([
  "aceite", "sal", "pimienta", "ajo", "huevo", "harina", "azucar", "leche", "nata", "mantequilla", "caldo",
  "agua", "vinagre", "perejil", "laurel", "pimenton", "pan rallado", "queso rallado", "cebolla", "patata", "tomate triturado",
]);

/** Clave para agrupar ("Cebollas grandes" y "cebolla" → "cebolla"). */
export function shoppingKey(name: string): string {
  const entry = findCatalog(name);
  if (entry && MERGE_BY_ENTRY.has(entry.match)) return entry.match;
  const kept = tokens(name).filter((t) => !DROP.has(t));
  return kept.join(" ") || tokens(name).join(" ");
}

// ---------------------------------------------------------------- cantidades

const empty = (): Amounts => ({ g: 0, ml: 0, counts: {}, toTaste: false });

export function addLine(a: Amounts, quantity: number | null, unitKey: string | null): void {
  const unit = getUnit(unitKey);
  if (quantity === null || quantity <= 0 || unit?.dimension === "vague") {
    a.toTaste = true;
    return;
  }
  if (!unit) a.counts.ud = (a.counts.ud ?? 0) + quantity;
  else if (unit.dimension === "mass") a.g += quantity * unit.factor;
  else if (unit.dimension === "volume") a.ml += quantity * unit.factor;
  else a.counts[unit.key] = (a.counts[unit.key] ?? 0) + quantity;
}

/** Unifica piezas ↔ gramos según cómo se compra el producto. */
export function normalizeAmounts(a: Amounts, entry: CatalogEntry | null): Amounts {
  const out: Amounts = { ...a, counts: { ...a.counts } };
  const gpu = entry?.gramsPerUnit;
  const ud = out.counts.ud ?? 0;
  if (!gpu || !ud) {
    // Solo gramos de algo que se compra por unidades: pasar a unidades
    if (gpu && entry?.buyBy === "unit" && out.g > 0 && !ud) {
      out.counts.ud = out.g / gpu;
      out.g = 0;
    }
    return out;
  }
  if (entry?.buyBy === "weight") {
    out.g += ud * gpu;
    delete out.counts.ud;
  } else {
    out.counts.ud = ud + out.g / gpu;
    out.g = 0;
  }
  return out;
}

const num = (n: number, decimals = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: decimals });

/** Texto "para comprar", siempre redondeando hacia arriba. */
export function formatAmounts(a: Amounts): string {
  const parts: string[] = [];
  if (a.g > 0.5) {
    if (a.g < 1000) parts.push(`${a.g <= 50 ? Math.ceil(a.g / 5) * 5 : Math.ceil(a.g / 10) * 10} g`);
    else parts.push(`${num(Math.ceil(a.g / 100) / 10)} kg`);
  }
  if (a.ml > 0.5) {
    // Cucharadas solo para cantidades pequeñas (aceite para un sofrito);
    // a partir de 30 ml se compra/mide en ml.
    if (a.ml < 15) {
      const cdtas = Math.ceil((a.ml / 5) * 2) / 2;
      parts.push(`${formatQuantity(cdtas)} ${cdtas > 1 ? "cdtas" : "cdta"}`);
    } else if (a.ml <= 30) {
      const cdas = Math.ceil((a.ml / 15) * 2) / 2;
      parts.push(`${formatQuantity(cdas)} ${cdas > 1 ? "cdas" : "cda"}`);
    } else if (a.ml < 1000) parts.push(`${Math.ceil(a.ml / 10) * 10} ml`);
    else parts.push(`${num(Math.ceil(a.ml / 100) / 10)} l`);
  }
  // Unidades sueltas primero ("2 uds + 1 lata")
  const counts = Object.entries(a.counts).sort(([u1], [u2]) => (u1 === "ud" ? -1 : u2 === "ud" ? 1 : 0));
  for (const [unit, value] of counts) {
    if (value <= 0.01) continue;
    const n = Math.ceil(value - 1e-9);
    parts.push(`${n} ${unitLabel(unit, n)}`);
  }
  return parts.join(" + ");
}

const hasQuantity = (a: Amounts) => a.g > 0.5 || a.ml > 0.5 || Object.values(a.counts).some((v) => v > 0.01);

// ---------------------------------------------------------------- coste

/** Coste orientativo de unas cantidades (null si no hay precio aplicable). */
export function estimateCost(a: Amounts, entry: CatalogEntry | null): number | null {
  if (!entry) return null;
  let cost = 0;
  let priced = false;
  if (a.g > 0 && entry.pricePerKg) {
    cost += (a.g / 1000) * entry.pricePerKg;
    priced = true;
  }
  if (a.ml > 0 && (entry.pricePerLiter || entry.pricePerKg)) {
    cost += (a.ml / 1000) * (entry.pricePerLiter ?? entry.pricePerKg!);
    priced = true;
  }
  for (const [unit, n] of Object.entries(a.counts)) {
    if (unit === "ud" || unit === "lata" || unit === "bote" || unit === "paquete") {
      if (entry.pricePerUnit) cost += n * entry.pricePerUnit;
      else if (entry.gramsPerUnit && entry.pricePerKg) cost += ((n * entry.gramsPerUnit) / 1000) * entry.pricePerKg;
      else continue;
      priced = true;
    } else if (unit === "diente" && entry.pricePerUnit) {
      cost += (n / 10) * entry.pricePerUnit; // una cabeza ≈ 10 dientes
      priced = true;
    }
  }
  return priced ? Math.round(cost * 100) / 100 : null;
}

/** Coste orientativo de una receta completa (para el presupuesto del menú). */
export function recipeCost(ingredients: { name: string; quantity: number | null; unit: string | null }[]): number | null {
  let total = 0;
  let priced = 0;
  for (const ing of ingredients) {
    const a = empty();
    addLine(a, ing.quantity, ing.unit);
    if (!hasQuantity(a)) continue; // "al gusto": despreciable
    const c = estimateCost(a, findCatalog(ing.name));
    if (c !== null) {
      total += c;
      priced++;
    }
  }
  return priced > 0 ? Math.round(total * 100) / 100 : null;
}

// ---------------------------------------------------------------- lista

function subtract(need: Amounts, have: Amounts, entry: CatalogEntry | null): Amounts {
  const gpu = entry?.gramsPerUnit;
  const out: Amounts = { ...need, counts: { ...need.counts } };
  let g = have.g;
  let ud = have.counts.ud ?? 0;
  // Convertir lo que tengo a la dimensión en que lo necesito
  if (gpu) {
    if (out.counts.ud && g) {
      ud += g / gpu;
      g = 0;
    } else if (out.g && ud) {
      g += ud * gpu;
      ud = 0;
    }
  }
  out.g = Math.max(0, out.g - g);
  out.ml = Math.max(0, out.ml - have.ml);
  for (const [unit, n] of Object.entries(have.counts)) {
    const has = unit === "ud" ? ud : n;
    if (out.counts[unit]) out.counts[unit] = Math.max(0, out.counts[unit] - has);
  }
  return out;
}

export function buildShoppingList(lines: NeedLine[], pantry: PantryLine[] = []): ShoppingResult {
  const groups = new Map<string, { names: string[]; amounts: Amounts; sources: Set<string> }>();
  for (const line of lines) {
    const name = line.name.trim();
    if (!name) continue;
    const key = shoppingKey(name);
    const g = groups.get(key) ?? { names: [], amounts: empty(), sources: new Set<string>() };
    g.names.push(name);
    addLine(g.amounts, line.quantity, line.unit);
    if (line.source) g.sources.add(line.source);
    groups.set(key, g);
  }

  const items: ShoppingEntry[] = [];
  const covered: ShoppingResult["covered"] = [];

  for (const [key, g] of groups) {
    // Nombre a mostrar: el más corto ("cebolla" mejor que "cebolla grande picada")
    const name = [...g.names].sort((a, b) => a.length - b.length)[0];
    const entry = findCatalog(name);
    const need = normalizeAmounts(g.amounts, entry);
    const amountText = formatAmounts(need);

    const inPantry = pantry.filter((p) => shoppingKey(p.name) === key || ingredientMatches(p.name, name));
    let final = need;
    let pantryNote: string | null = null;

    if (inPantry.length > 0) {
      // Despensa sin cantidad = "tengo de sobra"
      if (inPantry.some((p) => p.quantity === null) || !hasQuantity(need)) {
        covered.push({ key, name, amount: amountText });
        continue;
      }
      const have = empty();
      for (const p of inPantry) addLine(have, p.quantity, p.unit);
      final = subtract(need, normalizeAmounts(have, entry), entry);
      if (!hasQuantity(final)) {
        covered.push({ key, name, amount: amountText });
        continue;
      }
      pantryNote = `Tienes ${formatAmounts(normalizeAmounts(have, entry))}`;
    }

    items.push({
      key,
      name,
      section: sectionFor(name),
      amount: formatAmounts(final),
      toTaste: !hasQuantity(final),
      sources: [...g.sources],
      cost: estimateCost(final, entry),
      pantryNote,
    });
  }

  const order = (s: Section) => SECTIONS.indexOf(s);
  items.sort((a, b) => order(a.section) - order(b.section) || a.name.localeCompare(b.name, "es"));
  return { items, covered };
}

/** Texto plano para compartir por WhatsApp/Notas. */
export function shoppingListText(
  title: string,
  items: { name: string; amount: string; section: Section; checked?: boolean }[],
  labels: Record<Section, string>,
): string {
  const lines = [`🛒 ${title}`];
  for (const section of SECTIONS) {
    const inSection = items.filter((i) => i.section === section && !i.checked);
    if (inSection.length === 0) continue;
    lines.push("", `*${labels[section]}*`);
    for (const i of inSection) lines.push(`- ${i.name}${i.amount ? ` (${i.amount})` : ""}`);
  }
  return lines.join("\n");
}

/** Elemento añadido a mano: "2 kg de patatas" → patatas · 2 kg · Frutería. */
export function manualEntry(text: string): Pick<ShoppingEntry, "key" | "name" | "section" | "amount" | "toTaste"> {
  const parsed = parseIngredientLine(text);
  const a = empty();
  if (parsed.quantity !== null) addLine(a, parsed.quantity, parsed.unit);
  const name = parsed.name.slice(0, 80);
  return {
    key: shoppingKey(name),
    name,
    section: sectionFor(name),
    amount: formatAmounts(a),
    toTaste: !hasQuantity(a),
  };
}
