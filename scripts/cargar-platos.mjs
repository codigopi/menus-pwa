// Carga en la base de datos los platos de:
//   scripts/platos-habituales.json  (los de la casa)
//   scripts/platos-sugeridos.json   (propuestos para equilibrar la pirámide; etiqueta "sugerida")
//
// - No duplica: si ya hay una receta con el mismo título, la deja como está…
// - …salvo que exista pero esté vacía (sin ingredientes): entonces la completa.
// - Aplica antes las migraciones pendientes.
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
const files = ["platos-habituales.json", "platos-sugeridos.json"];
const recetas = files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8")).recetas);

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
migrate(drizzle(sqlite), { migrationsFolder: path.join(here, "..", "drizzle") });

const existing = new Map(
  sqlite
    .prepare("select r.id, lower(r.title) t, (select count(*) from recipe_ingredients i where i.recipe_id = r.id) n from recipes r")
    .all()
    .map((r) => [r.t, r]),
);
const insertRecipe = sqlite.prepare(
  `insert into recipes (id, title, description, servings, prep_minutes, cook_minutes, steps, tags, source_type, is_favorite, created_at, updated_at)
   values (@id, @title, @description, 4, @prep, @cook, @steps, @tags, 'manual', 0, @now, @now)`,
);
const completeRecipe = sqlite.prepare(
  `update recipes set description = @description, prep_minutes = @prep, cook_minutes = @cook, steps = @steps, tags = @tags, updated_at = @now where id = @id`,
);
const insertIngredient = sqlite.prepare(
  `insert into recipe_ingredients (id, recipe_id, position, quantity, unit, name, note) values (?, ?, ?, ?, ?, ?, ?)`,
);

const params = (r, id) => ({
  id,
  title: r.title,
  description: r.description ?? null,
  prep: r.prep,
  cook: r.cook,
  steps: JSON.stringify(r.steps.map((text) => ({ text }))),
  tags: JSON.stringify(r.tags),
  now: Date.now(),
});
const addIngredients = (r, id) =>
  r.ingredients.forEach(([quantity, unit, name, note], i) => insertIngredient.run(randomUUID(), id, i, quantity, unit, name, note ?? null));

let added = 0;
const completed = [];
const skipped = [];
sqlite.transaction(() => {
  for (const r of recetas) {
    const prev = existing.get(r.title.toLowerCase());
    if (!prev) {
      const id = randomUUID();
      insertRecipe.run(params(r, id));
      addIngredients(r, id);
      added++;
    } else if (prev.n === 0 && r.ingredients.length > 0) {
      completeRecipe.run(params(r, prev.id));
      addIngredients(r, prev.id);
      completed.push(r.title);
    } else {
      skipped.push(r.title);
    }
  }
})();

console.log(`✓ ${added} platos añadidos en ${dbFile}`);
if (completed.length) console.log(`✓ completados: ${completed.join(", ")}`);
if (skipped.length) console.log(`  (${skipped.length} ya existían y no se han tocado)`);
