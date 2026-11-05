/**
 * Extracción de información de páginas HTML sin dependencias (regex
 * tolerantes). No buscamos un parser perfecto: solo sacar lo útil para
 * reconstruir una receta.
 */
import type { SourceType } from "@/lib/domain/recipe";

// ---------------------------------------------------------------- utilidades

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
  uuml: "ü", iexcl: "¡", iquest: "¿", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
  hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Idioma declarado en <html lang="…"> (minúsculas) o null. */
export function htmlLang(html: string): string | null {
  return html.match(/<html[^>]*\blang=["']?([a-z-]+)/i)?.[1].toLowerCase() ?? null;
}

// ---------------------------------------------------------------- metadatos

export interface PageMeta {
  title: string | null;
  description: string | null;
  image: string | null;
}

function metaContent(html: string, key: string): string | null {
  // Acepta property= o name=, y content antes o después.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  const value = m?.[1] ?? m?.[2];
  return value ? decodeEntities(value).trim() || null : null;
}

export function extractMeta(html: string): PageMeta {
  return {
    title: metaContent(html, "og:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? stripTags(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null),
    description: metaContent(html, "og:description") ?? metaContent(html, "description"),
    image: metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
  };
}

// ---------------------------------------------------------------- JSON-LD

type Json = Record<string, unknown>;

const isRecipeType = (t: unknown) =>
  t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));

function findRecipe(node: unknown): Json | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Json;
  if (isRecipeType(obj["@type"])) return obj;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findRecipe(obj[key]);
    if (found) return found;
  }
  return null;
}

/** Primer objeto schema.org/Recipe de los bloques JSON-LD de la página. */
export function extractJsonLdRecipe(html: string): Json | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, content] of blocks) {
    try {
      const found = findRecipe(JSON.parse(content.trim()));
      if (found) return found;
    } catch {
      // JSON-LD mal formado: lo ignoramos y probamos el siguiente bloque
    }
  }
  return null;
}

// ---------------------------------------------------------------- redes

/** Detecta la red social / tipo de fuente a partir del enlace. */
export function detectSource(url: string): Extract<SourceType, "web" | "instagram" | "tiktok" | "youtube"> {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return "web";
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube";
  return "web";
}

/** Primer enlace http(s) dentro de un texto (lo que comparte Android/iOS). */
export function extractFirstUrl(text: string): string | null {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0].replace(/[),.;!?]+$/, "") ?? null;
}

/** Descripción completa de un vídeo de YouTube (incluido en la página). */
export function extractYoutubeDescription(html: string): string | null {
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try {
    return (JSON.parse(`"${m[1]}"`) as string).trim() || null;
  } catch {
    return null;
  }
}

/** Texto del post de TikTok (campo "desc" de los datos de la página). */
export function extractTiktokDescription(html: string): string | null {
  const m = html.match(/"desc":"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try {
    return (JSON.parse(`"${m[1]}"`) as string).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Instagram pone el texto del post en og:description con un prefijo:
 * `123 likes, 4 comments - usuario on March 1, 2025: "texto…".`
 */
export function cleanInstagramDescription(desc: string): string {
  const m = desc.match(/^[^:]{0,200}?(?:\bon\b|\bel\b)[^:]{0,60}:\s*["“]([\s\S]*)["”]\.?\s*$/);
  return (m ? m[1] : desc).trim();
}

// ---------------------------------------------------------------- texto legible

/**
 * Convierte una página en texto plano para la IA: quita scripts, estilos,
 * navegación y pies, conserva saltos de línea de bloques. Recorta a `max`.
 */
export function htmlToText(html: string, max = 20_000): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const text = body
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}
