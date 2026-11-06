/**
 * Lecturas para Server Components.
 *
 * Con Cache Components, el trabajo síncrono (better-sqlite3) se ejecutaría en
 * el prerender del build y quedaría congelado. `connection()` marca la lectura
 * como "en tiempo de petición", así los datos siempre están frescos.
 */
import { connection } from "next/server";
import { loadTaste, withTaste } from "@/lib/taste/service";
import * as repo from "./repo";

export async function fetchRecipes() {
  await connection();
  return repo.listRecipes();
}

export async function fetchRecipesForMatching() {
  await connection();
  const { recipes, profile } = loadTaste();
  return withTaste(recipes, profile);
}

export async function fetchRecipe(id: string) {
  await connection();
  return repo.getRecipe(id);
}
