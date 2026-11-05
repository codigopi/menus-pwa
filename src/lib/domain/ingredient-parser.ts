/**
 * Lector de líneas de ingrediente escritas en español:
 *   "2 dientes de ajo, picados"     → 2 · diente · "ajo" · nota "picados"
 *   "200g de harina"                 → 200 · g · "harina"
 *   "1 lata de tomate (400 g)"       → 1 · lata · "tomate" · nota "400 g"
 *   "Medio pimiento rojo"            → 0,5 · — · "pimiento rojo"
 *   "Sal al gusto"                   → — · — · "sal"
 *
 * Se usa para importar webs con datos estructurados (JSON-LD) sin gastar IA.
 * Es deliberadamente conservador: ante la duda, deja el texto en el nombre.
 */
import { parseQuantity } from "./quantity";
import type { IngredientInput } from "./recipe";
import { getUnit, normalizeUnit } from "./units";

const WORD_NUMBERS: [RegExp, number][] = [
  [/^un par de\s+/i, 2],
  [/^(?:medio|media)\s+/i, 0.5],
  [/^(?:un|uno|una)\s+/i, 1],
  [/^dos\s+/i, 2],
  [/^tres\s+/i, 3],
  [/^cuatro\s+/i, 4],
  [/^cinco\s+/i, 5],
  [/^seis\s+/i, 6],
];

/** Número al principio: "1 1/2", "1/2", "1,5", "1½", "½", "2-3", "2 a 3". */
const QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½⅓⅔¼¾]?|[½⅓⅔¼¾])(?:\s*(?:-|–|a)\s*\d+(?:[.,]\d+)?)?/;

/** Marcas de "cantidad al gusto" que se eliminan del nombre. */
const VAGUE_RE = /\s*\b(?:al gusto|a gusto|c\/n|c\.n\.|c\.s\.|cantidad (?:necesaria|suficiente))\b\.?/gi;

/** Modificadores de unidad que no aportan ("cucharada sopera", "cucharadita de postre"). */
const UNIT_MODIFIER_RE = /^(?:soperas?|de postre|de café|de cafe|grandes?|pequeñas?)\s+/i;

function lowerFirst(s: string): string {
  // Respeta siglas ("AOVE"): solo baja la inicial si la segunda letra es minúscula.
  if (s.length > 1 && s[1] === s[1].toLowerCase()) return s[0].toLowerCase() + s.slice(1);
  return s;
}

export function parseIngredientLine(raw: string, group: string | null = null): IngredientInput {
  let text = raw
    .replace(/^[\s\-–•*·▪︎✔️✅]+/u, "")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Cantidad (numérica o con palabras)
  let quantity: number | null = null;
  const num = text.match(QTY_RE);
  if (num) {
    const q = parseQuantity(num[1].replace(/\s+(?=[½⅓⅔¼¾])/, ""));
    if (q !== null && !Number.isNaN(q) && q > 0) {
      quantity = q;
      text = text.slice(num[0].length).trim();
    }
  } else {
    for (const [re, value] of WORD_NUMBERS) {
      if (re.test(text)) {
        quantity = value;
        text = text.replace(re, "");
        break;
      }
    }
  }

  // 2. Unidad (solo si hay cantidad: "Lata de atún" a secas es un nombre)
  let unit: IngredientInput["unit"] = null;
  if (quantity !== null) {
    const token = text.match(/^([a-záéíóúñ./]+)(?=\s|$)/i)?.[1];
    const key = token ? normalizeUnit(token) : null;
    if (token && key) {
      unit = key;
      text = text.slice(token.length).trim().replace(UNIT_MODIFIER_RE, "");
    }
  }

  // 3. Conector "de"/"del" tras cantidad o unidad
  if (quantity !== null) text = text.replace(/^(?:de|del|d')\s+/i, "");

  // 4. Nota: lo que va entre paréntesis o tras la primera coma
  let note: string | null = null;
  const paren = text.match(/\s*\(([^)]*)\)\s*/);
  if (paren) {
    note = paren[1].trim() || null;
    text = text.replace(paren[0], " ").trim();
  }
  const comma = text.indexOf(",");
  if (comma > 0) {
    const after = text.slice(comma + 1).trim();
    note = [note, after].filter(Boolean).join(", ") || null;
    text = text.slice(0, comma).trim();
  }

  // 5. Limpieza final del nombre
  let name = text.replace(VAGUE_RE, "").replace(/[.;:]+$/, "").trim();
  if (note) note = note.replace(VAGUE_RE, "").replace(/[.;]+$/, "").trim() || null;
  if (!name) name = raw.trim();

  // Sin cantidad, una unidad imprecisa no aporta nada ("pizca" a secas).
  if (quantity === null && unit && getUnit(unit)?.dimension === "vague") unit = null;

  return { quantity, unit, name: lowerFirst(name).slice(0, 120), note: note?.slice(0, 120) ?? null, group };
}
