/**
 * Catálogo de ingredientes habituales en España: sección del súper, peso por
 * unidad (para convertir "2 cebollas" ↔ gramos), cómo se suele comprar y un
 * precio ORIENTATIVO (2026, súper medio) para estimar costes.
 *
 * Las entradas se buscan por las palabras normalizadas del ingrediente
 * (ver `tokens()`): gana la coincidencia más larga al principio del nombre,
 * así "tomate triturado" va a Despensa y "tomate" a Frutería.
 */
import { heads, tokens } from "./matching";

export const SECTIONS = [
  "fruteria",
  "carniceria",
  "pescaderia",
  "lacteos",
  "panaderia",
  "despensa",
  "especias",
  "congelados",
  "bebidas",
  "otros",
] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  fruteria: "Frutería y verdura",
  carniceria: "Carnicería",
  pescaderia: "Pescadería",
  lacteos: "Lácteos y huevos",
  panaderia: "Panadería",
  despensa: "Despensa",
  especias: "Especias y condimentos",
  congelados: "Congelados",
  bebidas: "Bebidas",
  otros: "Otros",
};

export interface CatalogEntry {
  /** Palabras normalizadas ("tomate triturado"). */
  match: string;
  section: Section;
  /** Gramos aproximados de una unidad (una cebolla ≈ 150 g). */
  gramsPerUnit?: number;
  /** Cómo se compra: por unidades (cebollas) o al peso (patatas). */
  buyBy?: "unit" | "weight";
  /** Precio orientativo. */
  pricePerKg?: number;
  pricePerUnit?: number;
  pricePerLiter?: number;
}

const E = (match: string, section: Section, extra: Omit<CatalogEntry, "match" | "section"> = {}): CatalogEntry => ({
  match,
  section,
  ...extra,
});

export const CATALOG: CatalogEntry[] = [
  // Frutería y verdura
  E("cebolla", "fruteria", { gramsPerUnit: 150, buyBy: "unit", pricePerKg: 1.5 }),
  E("cebolleta", "fruteria", { gramsPerUnit: 100, buyBy: "unit", pricePerUnit: 0.6 }),
  E("ajo", "fruteria", { gramsPerUnit: 50, buyBy: "unit", pricePerUnit: 0.5 }),
  E("patata", "fruteria", { gramsPerUnit: 200, buyBy: "weight", pricePerKg: 1.4 }),
  E("tomate", "fruteria", { gramsPerUnit: 130, buyBy: "weight", pricePerKg: 2.5 }),
  E("tomate cherry", "fruteria", { pricePerKg: 5 }),
  E("pimiento", "fruteria", { gramsPerUnit: 160, buyBy: "unit", pricePerKg: 3 }),
  E("zanahoria", "fruteria", { gramsPerUnit: 80, buyBy: "weight", pricePerKg: 1.2 }),
  E("calabacin", "fruteria", { gramsPerUnit: 250, buyBy: "unit", pricePerKg: 2 }),
  E("berenjena", "fruteria", { gramsPerUnit: 300, buyBy: "unit", pricePerKg: 2.5 }),
  E("puerro", "fruteria", { gramsPerUnit: 150, buyBy: "unit", pricePerUnit: 0.8 }),
  E("lechuga", "fruteria", { gramsPerUnit: 400, buyBy: "unit", pricePerUnit: 1 }),
  E("espinaca", "fruteria", { pricePerKg: 6 }),
  E("acelga", "fruteria", { pricePerKg: 3 }),
  E("champinon", "fruteria", { pricePerKg: 4 }),
  E("seta", "fruteria", { pricePerKg: 8 }),
  E("calabaza", "fruteria", { pricePerKg: 1.8 }),
  E("brocoli", "fruteria", { gramsPerUnit: 400, buyBy: "unit", pricePerKg: 3 }),
  E("coliflor", "fruteria", { gramsPerUnit: 800, buyBy: "unit", pricePerUnit: 2 }),
  E("judia verde", "fruteria", { pricePerKg: 4 }),
  E("pepino", "fruteria", { gramsPerUnit: 300, buyBy: "unit", pricePerKg: 1.8 }),
  E("aguacate", "fruteria", { gramsPerUnit: 200, buyBy: "unit", pricePerUnit: 1.2 }),
  E("limon", "fruteria", { gramsPerUnit: 100, buyBy: "unit", pricePerKg: 2.5 }),
  E("lima", "fruteria", { gramsPerUnit: 70, buyBy: "unit", pricePerUnit: 0.5 }),
  E("naranja", "fruteria", { gramsPerUnit: 200, buyBy: "weight", pricePerKg: 1.8 }),
  E("manzana", "fruteria", { gramsPerUnit: 180, buyBy: "weight", pricePerKg: 2.5 }),
  E("platano", "fruteria", { gramsPerUnit: 150, buyBy: "weight", pricePerKg: 2 }),
  E("pera", "fruteria", { gramsPerUnit: 180, buyBy: "weight", pricePerKg: 2.5 }),
  E("fresa", "fruteria", { pricePerKg: 5 }),
  E("perejil", "fruteria", { buyBy: "unit", pricePerUnit: 0.8 }),
  E("cilantro", "fruteria", { buyBy: "unit", pricePerUnit: 0.9 }),
  E("albahaca", "fruteria", { buyBy: "unit", pricePerUnit: 1.5 }),
  E("hierbabuena", "fruteria", { buyBy: "unit", pricePerUnit: 1 }),
  E("jengibre", "fruteria", { pricePerKg: 6 }),
  E("apio", "fruteria", { pricePerKg: 2 }),
  E("nabo", "fruteria", { pricePerKg: 1.5 }),
  E("boniato", "fruteria", { gramsPerUnit: 300, buyBy: "weight", pricePerKg: 2 }),
  E("alcachofa", "fruteria", { gramsPerUnit: 200, buyBy: "unit", pricePerKg: 3.5 }),
  E("esparrago", "fruteria", { pricePerKg: 7 }),
  E("rucula", "fruteria", { pricePerKg: 10 }),
  // Carnicería
  E("pollo", "carniceria", { pricePerKg: 5.5 }),
  E("pechuga pollo", "carniceria", { gramsPerUnit: 250, buyBy: "weight", pricePerKg: 8 }),
  E("pechuga", "carniceria", { gramsPerUnit: 250, buyBy: "weight", pricePerKg: 8 }),
  E("muslo", "carniceria", { gramsPerUnit: 150, buyBy: "weight", pricePerKg: 4.5 }),
  E("contramuslo", "carniceria", { gramsPerUnit: 120, buyBy: "weight", pricePerKg: 6 }),
  E("alita", "carniceria", { pricePerKg: 4 }),
  E("pavo", "carniceria", { pricePerKg: 9 }),
  E("ternera", "carniceria", { pricePerKg: 15 }),
  E("carne picada", "carniceria", { pricePerKg: 9 }),
  E("carne", "carniceria", { pricePerKg: 12 }),
  E("cerdo", "carniceria", { pricePerKg: 7 }),
  E("lomo", "carniceria", { pricePerKg: 8 }),
  E("solomillo", "carniceria", { pricePerKg: 12 }),
  E("costilla", "carniceria", { pricePerKg: 7 }),
  E("cordero", "carniceria", { pricePerKg: 15 }),
  E("conejo", "carniceria", { pricePerKg: 8 }),
  E("morcillo", "carniceria", { pricePerKg: 12 }),
  E("chorizo", "carniceria", { gramsPerUnit: 100, buyBy: "weight", pricePerKg: 10 }),
  E("morcilla", "carniceria", { gramsPerUnit: 150, buyBy: "unit", pricePerKg: 8 }),
  E("jamon", "carniceria", { pricePerKg: 20 }),
  E("bacon", "carniceria", { pricePerKg: 10 }),
  E("panceta", "carniceria", { pricePerKg: 8 }),
  E("salchicha", "carniceria", { gramsPerUnit: 60, buyBy: "unit", pricePerKg: 6 }),
  E("hamburguesa", "carniceria", { gramsPerUnit: 120, buyBy: "unit", pricePerUnit: 1 }),
  // Pescadería
  E("merluza", "pescaderia", { pricePerKg: 12 }),
  E("bacalao", "pescaderia", { pricePerKg: 14 }),
  E("salmon", "pescaderia", { pricePerKg: 15 }),
  E("atun fresco", "pescaderia", { pricePerKg: 18 }),
  E("bonito", "pescaderia", { pricePerKg: 14 }),
  E("sardina", "pescaderia", { pricePerKg: 6 }),
  E("boqueron", "pescaderia", { pricePerKg: 7 }),
  E("caballa", "pescaderia", { pricePerKg: 7 }),
  E("dorada", "pescaderia", { gramsPerUnit: 400, buyBy: "unit", pricePerKg: 9 }),
  E("lubina", "pescaderia", { gramsPerUnit: 400, buyBy: "unit", pricePerKg: 10 }),
  E("rape", "pescaderia", { pricePerKg: 18 }),
  E("gallo", "pescaderia", { gramsPerUnit: 300, buyBy: "unit", pricePerKg: 12 }),
  E("gamba", "pescaderia", { pricePerKg: 15 }),
  E("langostino", "pescaderia", { pricePerKg: 14 }),
  E("mejillon", "pescaderia", { pricePerKg: 4 }),
  E("almeja", "pescaderia", { pricePerKg: 15 }),
  E("calamar", "pescaderia", { pricePerKg: 10 }),
  E("sepia", "pescaderia", { pricePerKg: 10 }),
  E("pulpo", "pescaderia", { pricePerKg: 18 }),
  // Lácteos y huevos
  E("huevo", "lacteos", { gramsPerUnit: 60, buyBy: "unit", pricePerUnit: 0.28 }),
  E("leche", "lacteos", { pricePerLiter: 1.1 }),
  E("leche coco", "despensa", { pricePerLiter: 4 }),
  E("nata", "lacteos", { pricePerLiter: 4 }),
  E("mantequilla", "lacteos", { pricePerKg: 10 }),
  E("queso", "lacteos", { pricePerKg: 12 }),
  E("queso rallado", "lacteos", { pricePerKg: 11 }),
  E("queso fresco", "lacteos", { pricePerKg: 7 }),
  E("mozzarella", "lacteos", { gramsPerUnit: 125, buyBy: "unit", pricePerUnit: 1.2 }),
  E("parmesano", "lacteos", { pricePerKg: 20 }),
  E("yogur", "lacteos", { gramsPerUnit: 125, buyBy: "unit", pricePerUnit: 0.4 }),
  E("quesito", "lacteos", { gramsPerUnit: 17, buyBy: "unit", pricePerUnit: 0.15 }),
  // Panadería
  E("pan", "panaderia", { gramsPerUnit: 250, buyBy: "unit", pricePerUnit: 1 }),
  E("pan molde", "panaderia", { pricePerUnit: 1.8 }),
  E("pan hamburguesa", "panaderia", { gramsPerUnit: 60, buyBy: "unit", pricePerUnit: 0.4 }),
  E("pan perrito", "panaderia", { gramsPerUnit: 50, buyBy: "unit", pricePerUnit: 0.35 }),
  E("pan pita", "panaderia", { gramsPerUnit: 70, buyBy: "unit", pricePerUnit: 0.4 }),
  E("masa pizza", "lacteos", { buyBy: "unit", pricePerUnit: 1.5 }),
  // Despensa
  E("arroz", "despensa", { pricePerKg: 1.6 }),
  E("pasta", "despensa", { pricePerKg: 1.6 }),
  E("macarron", "despensa", { pricePerKg: 1.6 }),
  E("espagueti", "despensa", { pricePerKg: 1.6 }),
  E("tallarin", "despensa", { pricePerKg: 1.8 }),
  E("fideo", "despensa", { pricePerKg: 1.6 }),
  E("lasana", "despensa", { pricePerKg: 4 }),
  E("cuscus", "despensa", { pricePerKg: 3 }),
  E("lenteja", "despensa", { pricePerKg: 2.6 }),
  E("garbanzo", "despensa", { pricePerKg: 2.6 }),
  E("alubia", "despensa", { pricePerKg: 3 }),
  E("garbanzo cocido", "despensa", { pricePerKg: 2.5 }),
  E("lenteja cocida", "despensa", { pricePerKg: 2.5 }),
  E("alubia cocida", "despensa", { pricePerKg: 2.5 }),
  E("harina", "despensa", { pricePerKg: 0.9 }),
  E("azucar", "despensa", { pricePerKg: 1.3 }),
  E("aceite", "despensa", { pricePerLiter: 9 }),
  E("aceite girasol", "despensa", { pricePerLiter: 2 }),
  E("vinagre", "despensa", { pricePerLiter: 1.5 }),
  E("tomate triturado", "despensa", { pricePerKg: 1.8 }),
  E("tomate frito", "despensa", { pricePerKg: 2.6 }),
  E("tomate concentrado", "despensa", { pricePerKg: 6 }),
  E("pimiento piquillo", "despensa", { pricePerKg: 8 }),
  E("atun", "despensa", { gramsPerUnit: 80, buyBy: "unit", pricePerUnit: 1.3 }),
  E("caldo", "despensa", { pricePerLiter: 2 }),
  E("pan rallado", "despensa", { pricePerKg: 2 }),
  E("levadura", "despensa", { buyBy: "unit", pricePerUnit: 0.5 }),
  E("chocolate", "despensa", { pricePerKg: 10 }),
  E("cacao", "despensa", { pricePerKg: 8 }),
  E("miel", "despensa", { pricePerKg: 8 }),
  E("aceituna", "despensa", { pricePerKg: 5 }),
  E("maiz", "despensa", { pricePerKg: 3 }),
  E("nuez", "despensa", { pricePerKg: 12 }),
  E("almendra", "despensa", { pricePerKg: 12 }),
  E("pinon", "despensa", { pricePerKg: 50 }),
  E("pasa", "despensa", { pricePerKg: 6 }),
  E("mostaza", "despensa", { pricePerKg: 5 }),
  E("mayonesa", "despensa", { pricePerKg: 4 }),
  E("salsa soja", "despensa", { pricePerLiter: 6 }),
  E("vino blanco", "bebidas", { pricePerLiter: 3 }),
  E("vino tinto", "bebidas", { pricePerLiter: 3 }),
  E("cerveza", "bebidas", { pricePerLiter: 2 }),
  E("brandy", "bebidas", { pricePerLiter: 12 }),
  E("agua", "bebidas", { pricePerLiter: 0.3 }),
  // Especias y condimentos (se compran poco: precio por kg alto, cantidades mínimas)
  E("sal", "especias", { pricePerKg: 0.5 }),
  E("pimienta", "especias", { pricePerKg: 30 }),
  E("pimenton", "especias", { pricePerKg: 20 }),
  E("comino", "especias", { pricePerKg: 25 }),
  E("oregano", "especias", { pricePerKg: 30 }),
  E("laurel", "especias", { pricePerKg: 30 }),
  E("tomillo", "especias", { pricePerKg: 30 }),
  E("romero", "especias", { pricePerKg: 30 }),
  E("canela", "especias", { pricePerKg: 30 }),
  E("nuez moscada", "especias", { pricePerKg: 40 }),
  E("curry", "especias", { pricePerKg: 30 }),
  E("azafran", "especias", { pricePerUnit: 3 }),
  E("colorante", "especias", { pricePerUnit: 1 }),
  E("guindilla", "especias", { pricePerKg: 30 }),
  E("ketchup", "despensa", { pricePerKg: 4 }),
  E("salsa yogur", "despensa", { pricePerKg: 6 }),
  E("cebolla frita", "despensa", { pricePerKg: 10 }),
  // Congelados
  E("guisante", "congelados", { pricePerKg: 3 }),
  E("nugget", "congelados", { pricePerKg: 7 }),
  E("hamburguesa pescado", "congelados", { gramsPerUnit: 100, buyBy: "unit", pricePerUnit: 0.8 }),
];

/** Palabras que delatan conserva aunque el ingrediente no esté en el catálogo. */
const CANNED = new Set(["conserva", "lata", "bote", "triturado", "cocido", "frito", "congelado"]);

const BY_TOKENS = CATALOG.map((e) => ({ entry: e, t: e.match.split(" ") }));

function startsWith(haystack: string[], needle: string[]): boolean {
  return needle.length <= haystack.length && needle.every((w, i) => haystack[i] === w);
}

/** Entrada del catálogo para un nombre de ingrediente (o null). */
export function findCatalog(name: string): CatalogEntry | null {
  const t = tokens(name);
  if (t.length === 0) return null;

  // 1. La coincidencia más larga al principio ("tomate triturado" antes que "tomate").
  //    Se permite saltar adjetivos: "pimiento rojo del piquillo" → busca también sin la 2ª palabra.
  let best: { entry: CatalogEntry; len: number } | null = null;
  for (const { entry, t: et } of BY_TOKENS) {
    const ok = startsWith(t, et) || (et.length === 2 && t[0] === et[0] && t.includes(et[1]));
    if (ok && (!best || et.length > best.len)) best = { entry, len: et.length };
  }
  if (best) return best.entry;

  // 2. Cortes de carne/pescado: "contramuslos de pavo" → "pavo".
  for (const h of heads(name).slice(1)) {
    const hit = BY_TOKENS.find((b) => b.t.length === 1 && b.t[0] === h);
    if (hit) return hit.entry;
  }
  return null;
}

/** Sección del súper para un ingrediente. */
export function sectionFor(name: string): Section {
  const entry = findCatalog(name);
  if (entry) {
    // "tomate en conserva" → Despensa aunque "tomate" sea de frutería
    if (entry.section === "fruteria" && tokens(name).some((w) => CANNED.has(w))) return "despensa";
    return entry.section;
  }
  return tokens(name).some((w) => CANNED.has(w)) ? "despensa" : "otros";
}
