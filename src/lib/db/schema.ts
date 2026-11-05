/**
 * Esquema de base de datos (SQLite + Drizzle).
 *
 * Tras modificarlo: `npm run db:generate` crea una migración SQL en ./drizzle,
 * que se aplica automáticamente al arrancar la app.
 *
 * Fase 1: recetas e ingredientes. Las tablas de menús, compra, despensa e
 * histórico se añadirán en sus fases con nuevas migraciones.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { RecipeStep, SourceType } from "@/lib/domain/recipe";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    servings: integer("servings").notNull().default(2),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    /** Pasos en JSON: siempre se leen completos y en orden. */
    steps: text("steps", { mode: "json" }).$type<RecipeStep[]>().notNull().default(sql`'[]'`),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** Nombre del fichero en UPLOADS_DIR (no la ruta completa). */
    photo: text("photo"),
    sourceUrl: text("source_url"),
    sourceType: text("source_type").$type<SourceType>().notNull().default("manual"),
    rating: integer("rating"),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("recipes_updated_idx").on(t.updatedAt)],
);

/**
 * Ingredientes en tabla propia (no JSON) porque se consultarán por nombre en
 * "¿Qué cocino?", la lista de la compra y la despensa.
 */
export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    groupLabel: text("group_label"),
    /** null = "al gusto" */
    quantity: real("quantity"),
    unit: text("unit"),
    name: text("name").notNull(),
    note: text("note"),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);
