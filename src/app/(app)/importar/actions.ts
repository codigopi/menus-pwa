"use server";

import type { ImageInput } from "@/lib/ai/recipe-extractor";
import { importFromImages, importFromText, importFromUrl, type ImportResult } from "@/lib/importers/import-recipe";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function sniffImage(buf: Buffer): ImageInput["mediaType"] | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function optionalUrl(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Importa una receta y devuelve un borrador para revisar (no guarda nada,
 * salvo la foto descargada del origen).
 * FormData: mode = "enlace" | "texto" | "captura", y url / text / images.
 */
export async function importRecipe(formData: FormData): Promise<ImportResult> {
  const mode = formData.get("mode");

  if (mode === "enlace") {
    const url = optionalUrl(formData.get("url"));
    if (!url) return { ok: false, error: "Pega un enlace válido (que empiece por https://)." };
    return importFromUrl(url);
  }

  if (mode === "texto") {
    const text = String(formData.get("text") ?? "");
    return importFromText(text, optionalUrl(formData.get("url")));
  }

  if (mode === "captura") {
    const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) return { ok: false, error: `Como máximo ${MAX_IMAGES} capturas.` };
    const images: ImageInput[] = [];
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Alguna captura pesa demasiado (máx. 4 MB)." };
      const buf = Buffer.from(await file.arrayBuffer());
      const mediaType = sniffImage(buf);
      if (!mediaType) return { ok: false, error: "Formato de imagen no admitido (usa JPG, PNG o WebP)." };
      images.push({ mediaType, base64: buf.toString("base64") });
    }
    return importFromImages(images, optionalUrl(formData.get("url")));
  }

  return { ok: false, error: "Modo de importación desconocido." };
}
