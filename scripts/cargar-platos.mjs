// Carga los platos habituales de la casa (scripts/platos-habituales.json)
// en la base de datos. No duplica: si ya hay una receta con el mismo título,
// la salta. Aplica antes las migraciones pendientes.
//
// Uso:  npm run platos                      (BD local ./data/app.db)
//       DATABASE_PATH=/data/app.db node scripts/cargar-platos.mjs
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const dbFile = path.resolve(process.env.DATABASE_PATH ?? "./data/app.db");
const data = JSON.parse(fs.readFileSync(path.join(here, "platos-habituales.json"), "utf8"));

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
migrate(drizzle(sqlite), { migrationsFolder: path.join(here, "..", "drizzle") });

const existing = new Set(sqlite.prepare("select lower(title) t from recipes").all().map((r) => r.t));
const insertRecipe = sqlite.prepare(
  `insert into recipes (id, title, description, servings, prep_minutes, cook_minutes, steps, tags, source_type, is_favorite, created_at, updated_at)
   values (@id, @title, @description, 4, @prep, @cook, @steps, @tags, 'manual', 0, @now, @now)`,
);
const insertIngredient = sqlite.prepare(
  `insert into recipe_ingredients (id, recipe_id, position, quantity, unit, name, note) values (?, ?, ?, ?, ?, ?, ?)`,
);

let added = 0;
const skipped = [];
sqlite.transaction(() => {
  for (const r of data.recetas) {
    if (existing.has(r.title.toLowerCase())) {
      skipped.push(r.title);
      continue;
    }
    const id = randomUUID();
    insertRecipe.run({
      id,
      title: r.title,
      description: r.description ?? null,
      prep: r.prep,
      cook: r.cook,
      steps: JSON.stringify(r.steps.map((text) => ({ text }))),
      tags: JSON.stringify(r.tags),
      now: Date.now(),
    });
    r.ingredients.forEach(([quantity, unit, name, note], i) => insertIngredient.run(randomUUID(), id, i, quantity, unit, name, note ?? null));
    added++;
  }
})();

console.log(`✓ ${added} platos añadidos en ${dbFile}`);
if (skipped.length) console.log(`  (ya existían: ${skipped.join(", ")})`);
