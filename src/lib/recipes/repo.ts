/**
 * Acceso a datos de recetas. Solo servidor.
 *
 * Las funciones reciben la base de datos como último parámetro (por defecto la
 * de la app) para poder testearlas con una base en memoria.
 *
 * IMPORTANTE: better-sqlite3 es síncrono. Las páginas que lean datos deben
 * llamar antes a `await connection()` (ver src/lib/recipes/queries.ts).
 */
import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { recipeIngredients, recipes } from "@/lib/db/schema";
import type { IngredientInput, Recipe, RecipeInput, RecipeSummary } from "@/lib/domain/recipe";
import type { MatchableRecipe } from "@/lib/domain/matching";
import type { UnitKey } from "@/lib/domain/units";

type RecipeRow = typeof recipes.$inferSelect;
type IngredientRow = typeof recipeIngredients.$inferSelect;

function rowToIngredient(row: IngredientRow): IngredientInput {
  return {
    quantity: row.quantity,
    unit: (row.unit as UnitKey | null) ?? null,
    name: row.name,
    note: row.note,
    group: row.groupLabel,
  };
}

function rowToRecipe(row: RecipeRow, ingredients: IngredientRow[]): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    steps: row.steps,
    tags: row.tags,
    photo: row.photo,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
    rating: row.rating,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ingredients: ingredients.map(rowToIngredient),
  };
}

function ingredientRows(recipeId: string, list: IngredientInput[]) {
  return list.map((ing, position) => ({
    id: randomUUID(),
    recipeId,
    position,
    groupLabel: ing.group,
    quantity: ing.quantity,
    unit: ing.unit,
    name: ing.name,
    note: ing.note,
  }));
}

function recipeColumns(input: RecipeInput) {
  return {
    title: input.title,
    description: input.description,
    servings: input.servings,
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    steps: input.steps,
    tags: input.tags,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    rating: input.rating,
    isFavorite: input.isFavorite,
  };
}

/** Listado ligero para la biblioteca, últimas modificadas primero. */
export function listRecipes(db: AppDb = getDb()): RecipeSummary[] {
  return db
    .select({
      id: recipes.id,
      title: recipes.title,
      photo: recipes.photo,
      tags: recipes.tags,
      servings: recipes.servings,
      prepMinutes: recipes.prepMinutes,
      cookMinutes: recipes.cookMinutes,
      rating: recipes.rating,
      isFavorite: recipes.isFavorite,
    })
    .from(recipes)
    .orderBy(desc(recipes.updatedAt))
    .all();
}

/** Recetas con sus ingredientes (solo lo necesario) para "¿Qué cocino?". */
export function listRecipesForMatching(db: AppDb = getDb()): (RecipeSummary & MatchableRecipe)[] {
  const summaries = listRecipes(db);
  const rows = db
    .select({
      recipeId: recipeIngredients.recipeId,
      name: recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      unit: recipeIngredients.unit,
      note: recipeIngredients.note,
    })
    .from(recipeIngredients)
    .orderBy(asc(recipeIngredients.position))
    .all();

  const byRecipe = new Map<string, MatchableRecipe["ingredients"]>();
  for (const { recipeId, ...ing } of rows) {
    const list = byRecipe.get(recipeId) ?? [];
    list.push(ing);
    byRecipe.set(recipeId, list);
  }
  return summaries.map((s) => ({ ...s, ingredients: byRecipe.get(s.id) ?? [] }));
}

export function getRecipe(id: string, db: AppDb = getDb()): Recipe | null {
  const row = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!row) return null;
  const ings = db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(asc(recipeIngredients.position))
    .all();
  return rowToRecipe(row, ings);
}

export function createRecipe(
  input: RecipeInput,
  photo: string | null,
  db: AppDb = getDb(),
): string {
  const id = randomUUID();
  db.transaction((tx) => {
    tx.insert(recipes).values({ id, photo, ...recipeColumns(input) }).run();
    if (input.ingredients.length) {
      tx.insert(recipeIngredients).values(ingredientRows(id, input.ingredients)).run();
    }
  });
  return id;
}

/**
 * Actualiza una receta completa. Los ingredientes se reemplazan en bloque
 * (más simple y fiable que calcular diferencias para listas pequeñas).
 * `photo`: undefined = no tocar; null = quitar; string = nueva foto.
 * Devuelve la foto anterior si cambió (para borrar el fichero) o false si no existe.
 */
export function updateRecipe(
  id: string,
  input: RecipeInput,
  photo: string | null | undefined,
  db: AppDb = getDb(),
): { previousPhoto: string | null } | false {
  const current = db.select({ photo: recipes.photo }).from(recipes).where(eq(recipes.id, id)).get();
  if (!current) return false;

  db.transaction((tx) => {
    tx.update(recipes)
      .set({ ...recipeColumns(input), ...(photo !== undefined ? { photo } : {}) })
      .where(eq(recipes.id, id))
      .run();
    tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).run();
    if (input.ingredients.length) {
      tx.insert(recipeIngredients).values(ingredientRows(id, input.ingredients)).run();
    }
  });

  const photoChanged = photo !== undefined && photo !== current.photo;
  return { previousPhoto: photoChanged ? current.photo : null };
}

/** Borra la receta (los ingredientes caen en cascada). Devuelve su foto. */
export function deleteRecipe(id: string, db: AppDb = getDb()): { photo: string | null } | false {
  const current = db.select({ photo: recipes.photo }).from(recipes).where(eq(recipes.id, id)).get();
  if (!current) return false;
  db.delete(recipes).where(eq(recipes.id, id)).run();
  return { photo: current.photo };
}

export function setRating(id: string, rating: number | null, db: AppDb = getDb()): void {
  db.update(recipes).set({ rating }).where(eq(recipes.id, id)).run();
}

export function setFavorite(id: string, isFavorite: boolean, db: AppDb = getDb()): void {
  db.update(recipes).set({ isFavorite }).where(eq(recipes.id, id)).run();
}
