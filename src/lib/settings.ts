/**
 * Preferencias de la casa guardadas en la base de datos (compartidas entre
 * dispositivos, a diferencia de localStorage). Solo servidor.
 */
import { eq } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export function getSetting<T>(key: string, db: AppDb = getDb()): T | null {
  const row = db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).get();
  return row ? (row.value as T) : null;
}

export function setSetting(key: string, value: unknown, db: AppDb = getDb()): void {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
    .run();
}
