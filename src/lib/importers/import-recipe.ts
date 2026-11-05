/**
 * Orquestador del importador. Decide la vía más barata y fiable:
 *
 *   Enlace web con datos estructurados (JSON-LD) en español → sin IA
 *   Enlace web sin datos estructurados / en otro idioma    → texto de la página → IA
 *   Instagram / TikTok / YouTube                           → descripción del post → IA
 *   Texto pegado                                           → IA
 *   Capturas de pantalla                                   → IA con visión
 *
 * Cuando una red social no deja leer el texto, devolvemos un error con
 * sugerencia de "Plan B" (pegar el texto o subir captura).
 */
import type { RecipeInput, SourceType } from "@/lib/domain/recipe";
import { AI_PENDING_MESSAGE, isAiConfigured } from "@/lib/ai/config";
import { AiError, extractRecipeWithAI, type ImageInput } from "@/lib/ai/recipe-extractor";
import { savePhotoBuffer } from "@/lib/storage/photos";
import {
  cleanInstagramDescription,
  detectSource,
  extractJsonLdRecipe,
  extractMeta,
  extractTiktokDescription,
  extractYoutubeDescription,
  htmlLang,
  htmlToText,
} from "./html";
import { jsonLdToDraft } from "./jsonld";
import { FetchError, safeFetch } from "./net";

export type ImportResult =
  | {
      ok: true;
      draft: RecipeInput;
      /** Foto descargada del origen y ya guardada (o null). */
      photo: string | null;
      warnings: string[];
      /** Cómo se obtuvo, para mostrarlo en la UI. */
      via: "datos-web" | "ia";
    }
  | {
      ok: false;
      error: string;
      /** Plan B recomendado. */
      suggest?: "texto" | "captura";
    };

/** Mínimo de texto para que merezca la pena intentar extraer una receta. */
const MIN_USEFUL_TEXT = 60;

const PLAN_B: Record<string, string> = {
  instagram: "Instagram no deja leer el texto de este post desde fuera.",
  tiktok: "TikTok no deja leer el texto de este vídeo desde fuera.",
  youtube: "No he podido leer la descripción de este vídeo.",
  web: "No he encontrado una receta en esa página.",
};

async function downloadPhoto(url: string | null, base: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await safeFetch(new URL(url, base).toString(), { maxBytes: 5 * 1024 * 1024, timeoutMs: 8000 });
    return await savePhotoBuffer(res.body);
  } catch {
    return null; // la foto es un extra: si falla, seguimos sin ella
  }
}

function aiFailure(err: unknown, suggest?: "texto" | "captura"): ImportResult {
  if (err instanceof AiError) return { ok: false, error: err.message, suggest };
  console.error("[importar] error inesperado", err);
  return { ok: false, error: "Algo ha fallado al importar. Inténtalo de nuevo.", suggest };
}

export async function importFromUrl(rawUrl: string): Promise<ImportResult> {
  const sourceType = detectSource(rawUrl);
  let page;
  try {
    page = await safeFetch(rawUrl, {
      // Evita la pantalla de consentimiento de cookies de YouTube en la UE.
      headers: sourceType === "youtube" ? { Cookie: "SOCS=CAI" } : {},
    });
  } catch (err) {
    const msg = err instanceof FetchError ? err.message : "No se pudo abrir el enlace.";
    return { ok: false, error: `${msg} Puedes pegar el texto de la receta o subir una captura.`, suggest: "texto" };
  }

  const html = page.body.toString("utf8");
  const meta = extractMeta(html);
  const finalType = detectSource(page.url) === "web" ? sourceType : detectSource(page.url);

  // 1. Web con datos estructurados en español: sin IA.
  if (finalType === "web") {
    const ld = extractJsonLdRecipe(html);
    const lang = htmlLang(html);
    if (ld && (!lang || lang.startsWith("es"))) {
      const { draft, image } = jsonLdToDraft(ld, rawUrl);
      if (draft.ingredients.length > 0) {
        const photo = await downloadPhoto(image ?? meta.image, page.url);
        const warnings = draft.steps.length === 0 ? ["La web no incluía los pasos: añádelos a mano."] : [];
        return { ok: true, draft, photo, warnings, via: "datos-web" };
      }
    }
  }

  // 2. Reunimos el mejor texto disponible para la IA.
  let text: string | null = null;
  switch (finalType) {
    case "youtube":
      text = extractYoutubeDescription(html) ?? meta.description;
      break;
    case "tiktok":
      text = extractTiktokDescription(html) ?? meta.description;
      break;
    case "instagram":
      text = meta.description ? cleanInstagramDescription(meta.description) : null;
      break;
    default: {
      const ld = extractJsonLdRecipe(html);
      // Si hay JSON-LD (pero en otro idioma) se lo damos tal cual: es más limpio que la página.
      text = ld ? JSON.stringify(ld).slice(0, 20_000) : htmlToText(html);
    }
  }

  if (!isAiConfigured()) {
    return {
      ok: false,
      error:
        finalType === "web"
          ? "Esta web no trae la receta en formato estructurado y la IA está pendiente de configurar. De momento puedes escribirla a mano."
          : `Para importar desde ${finalType === "youtube" ? "YouTube" : finalType === "tiktok" ? "TikTok" : "Instagram"} hace falta la IA, que está pendiente de configurar.`,
    };
  }

  if (!text || text.length < MIN_USEFUL_TEXT) {
    return {
      ok: false,
      error: `${PLAN_B[finalType]} Copia el texto del post y pégalo en «Texto», o haz una captura de pantalla.`,
      suggest: finalType === "web" ? "texto" : "captura",
    };
  }

  const titleHint = meta.title ? `Título de la página: ${meta.title}\n\n` : "";
  try {
    const { draft, warnings } = await extractRecipeWithAI({
      text: titleHint + text,
      sourceType: finalType,
      sourceUrl: rawUrl,
    });
    const photo = await downloadPhoto(meta.image, page.url);
    return { ok: true, draft, photo, warnings, via: "ia" };
  } catch (err) {
    return aiFailure(err, finalType === "web" ? "texto" : "captura");
  }
}

export async function importFromText(text: string, sourceUrl: string | null): Promise<ImportResult> {
  if (!isAiConfigured()) return { ok: false, error: AI_PENDING_MESSAGE };
  const clean = text.trim().slice(0, 30_000);
  if (clean.length < 20) return { ok: false, error: "Pega un poco más de texto: necesito al menos los ingredientes." };
  const sourceType: SourceType = sourceUrl ? detectSource(sourceUrl) : "texto";
  try {
    const { draft, warnings } = await extractRecipeWithAI({ text: clean, sourceType, sourceUrl });
    return { ok: true, draft, photo: null, warnings, via: "ia" };
  } catch (err) {
    return aiFailure(err, "captura");
  }
}

export async function importFromImages(images: ImageInput[], sourceUrl: string | null): Promise<ImportResult> {
  if (!isAiConfigured()) return { ok: false, error: AI_PENDING_MESSAGE };
  if (images.length === 0) return { ok: false, error: "Añade al menos una captura." };
  try {
    const { draft, warnings } = await extractRecipeWithAI({
      images,
      sourceType: "captura",
      sourceUrl,
    });
    return { ok: true, draft, photo: null, warnings, via: "ia" };
  } catch (err) {
    return aiFailure(err, "texto");
  }
}
