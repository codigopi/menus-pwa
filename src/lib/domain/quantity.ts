/**
 * Cantidades: lectura de texto escrito a mano ("1/2", "1 ½", "0,5") y
 * formateo amigable en español (fracciones típicas de cocina, coma decimal).
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅛": 1 / 8,
};

/**
 * Convierte un texto de cantidad en número.
 *
 * Acepta: "2", "0,5", "0.5", "1/2", "1 1/2", "1½", "½", "2-3" (toma el primero).
 * Devuelve:
 *  - null si el texto está vacío (cantidad "al gusto")
 *  - NaN si hay texto pero no se entiende (para avisar en el formulario)
 */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let text = raw.trim();
  if (!text) return null;

  // Rangos "2-3" o "2 a 3": usamos el valor inferior.
  text = text.split(/\s*(?:-|–|\ba\b)\s*/)[0] ?? text;

  // Fracción unicode, sola o pegada a un entero: "½", "1½", "1 ½".
  const uni = text.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅛])$/);
  if (uni) {
    const whole = uni[1] ? Number(uni[1]) : 0;
    return whole + UNICODE_FRACTIONS[uni[2]];
  }

  // Número mixto "1 1/2" o fracción simple "1/2".
  const frac = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const whole = frac[1] ? Number(frac[1]) : 0;
    const den = Number(frac[3]);
    if (den === 0) return Number.NaN;
    return whole + Number(frac[2]) / den;
  }

  // Decimal con coma o punto.
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    return Number(text.replace(",", "."));
  }

  return Number.NaN;
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

/**
 * Formatea una cantidad para mostrarla en una receta.
 *  - Enteros tal cual: 2 → "2"
 *  - Cantidades pequeñas con fracción típica: 1.5 → "1½", 0.25 → "¼"
 *  - Resto con hasta 2 decimales y coma: 12.5 → "12,5"
 */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";

  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);

  if (value < 10) {
    const whole = Math.floor(value);
    const rest = value - whole;
    for (const [frac, glyph] of NICE_FRACTIONS) {
      if (Math.abs(rest - frac) < 0.02) return `${whole > 0 ? whole : ""}${glyph}`;
    }
  }

  return rounded.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/**
 * Formatea una cantidad para un campo de texto editable. Usa notación que
 * `parseQuantity` sabe volver a leer (fracciones con barra, coma decimal).
 */
export function quantityToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const pretty = formatQuantity(value);
  return pretty
    .replace(/(\d)([½⅓⅔¼¾])/, "$1 $2")
    .replace("½", "1/2")
    .replace("⅓", "1/3")
    .replace("⅔", "2/3")
    .replace("¼", "1/4")
    .replace("¾", "3/4");
}
