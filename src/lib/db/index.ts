/**
 * Conexión a SQLite.
 *
 * - Se abre de forma perezosa (no al importar el módulo) para que `next build`
 *   no cree ni toque la base de datos.
 * - Se reutiliza entre recargas en caliente guardándola en globalThis.
 * - Las migraciones de ./drizzle se aplican al abrir: desplegar = migrar.
 *   (La carpeta drizzle/ se copia aparte en el Dockerfile; turbopackIgnore evita
 *   que el build intente empaquetar rutas que solo existen en ejecución.)
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type AppDb = BetterSQLite3Database<typeof schema>;

/** Abre (o crea) una base de datos y aplica las migraciones pendientes. */
export function openDb(file: string): AppDb {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(/*turbopackIgnore: true*/ file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL"); // lecturas concurrentes sin bloquear escrituras
  sqlite.pragma("foreign_keys = ON"); // necesario para ON DELETE CASCADE
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  return db;
}

const globalForDb = globalThis as unknown as { __cocinaDb?: AppDb };

/** Conexión compartida de la aplicación. */
export function getDb(): AppDb {
  if (!globalForDb.__cocinaDb) {
    const file = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/app.db");
    globalForDb.__cocinaDb = openDb(file);
  }
  return globalForDb.__cocinaDb;
}

export { schema };
