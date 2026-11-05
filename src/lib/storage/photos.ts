/**
 * Almacenamiento de fotos en disco (volumen /data en producción).
 *
 * Los ficheros se nombran con un UUID aleatorio, así la URL es inmutable y
 * se puede cachear para siempre (también offline en el service worker).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { ext: "jpg" | "png" | "webp"; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export const PHOTO_MIME: Record<string, string> = Object.fromEntries(SIGNATURES.map((s) => [s.ext, s.mime]));

export function uploadsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR ?? "./data/uploads");
}

/** Evita rutas maliciosas: solo nombres generados por nosotros. */
export function isSafePhotoName(name: string): boolean {
  return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name);
}

export class PhotoError extends Error {}

/**
 * Guarda una imagen subida. Comprueba tamaño y el tipo real por los primeros
 * bytes (no nos fiamos del mime que envía el navegador).
 */
export async function savePhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("La imagen pesa más de 5 MB");
  return savePhotoBuffer(Buffer.from(await file.arrayBuffer()));
}

/** Guarda una imagen ya en memoria (p. ej. la descargada de la web de origen). */
export async function savePhotoBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length === 0) throw new PhotoError("La imagen está vacía");
  if (buffer.length > MAX_PHOTO_BYTES) throw new PhotoError("La imagen pesa más de 5 MB");
  const kind = SIGNATURES.find((s) => s.test(buffer));
  if (!kind) throw new PhotoError("Formato de imagen no admitido (usa JPG, PNG o WebP)");

  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${kind.ext}`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ dir, name), buffer);
  return name;
}

export async function deletePhoto(name: string | null | undefined): Promise<void> {
  if (!name || !isSafePhotoName(name)) return;
  await fs.rm(path.join(/*turbopackIgnore: true*/ uploadsDir(), name), { force: true });
}

export async function photoExists(name: string): Promise<boolean> {
  if (!isSafePhotoName(name)) return false;
  return fs
    .access(path.join(/*turbopackIgnore: true*/ uploadsDir(), name))
    .then(() => true)
    .catch(() => false);
}

export async function readPhoto(name: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!isSafePhotoName(name)) return null;
  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ uploadsDir(), name));
    return { data, mime: PHOTO_MIME[name.split(".").pop()!] };
  } catch {
    return null;
  }
}

