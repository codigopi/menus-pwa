/**
 * Limpieza de fotos huérfanas: las que descargó el importador para un
 * borrador que nunca se guardó, o las que quedaron de recetas editadas.
 * Solo borra ficheros con nombre generado por la app, sin receta que los use
 * y con más de `olderThanMs` de antigüedad (para no tocar un borrador en curso).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isNotNull } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { isSafePhotoName, uploadsDir } from "@/lib/storage/photos";

export async function cleanupOrphanPhotos({
  db = getDb(),
  dir = uploadsDir(),
  olderThanMs = 24 * 60 * 60 * 1000,
  now = Date.now(),
}: { db?: AppDb; dir?: string; olderThanMs?: number; now?: number } = {}): Promise<string[]> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return []; // aún no hay carpeta de fotos
  }
  const used = new Set(
    db.select({ photo: recipes.photo }).from(recipes).where(isNotNull(recipes.photo)).all().map((r) => r.photo!),
  );
  const deleted: string[] = [];
  for (const name of files) {
    if (!isSafePhotoName(name) || used.has(name)) continue;
    const file = path.join(/*turbopackIgnore: true*/ dir, name);
    const { mtimeMs } = await fs.stat(file);
    if (now - mtimeMs < olderThanMs) continue;
    await fs.rm(file, { force: true });
    deleted.push(name);
  }
  return deleted;
}
