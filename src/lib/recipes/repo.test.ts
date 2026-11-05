/**
 * Test de integración del repositorio contra SQLite en memoria.
 * También verifica que las migraciones de ./drizzle se aplican sin errores.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type AppDb } from "@/lib/db";
import { recipeInputSchema, type RecipeInput } from "@/lib/domain/recipe";
import { createRecipe, deleteRecipe, getRecipe, listRecipes, setFavorite, setRating, updateRecipe } from "./repo";

const tortilla = (): RecipeInput =>
  recipeInputSchema.parse({
    title: "Tortilla de patatas",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    tags: ["huevos"],
    ingredients: [
      { quantity: 6, unit: "ud", name: "huevos" },
      { quantity: 700, unit: "g", name: "patatas" },
      { quantity: null, unit: null, name: "sal" },
    ],
    steps: [{ text: "Freír las patatas." }, { text: "Cuajar con el huevo." }],
    rating: null,
  });

let db: AppDb;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("repositorio de recetas", () => {
  it("crea y lee una receta con ingredientes en orden", () => {
    const id = createRecipe(tortilla(), null, db);
    const r = getRecipe(id, db);
    expect(r?.title).toBe("Tortilla de patatas");
    expect(r?.ingredients.map((i) => i.name)).toEqual(["huevos", "patatas", "sal"]);
    expect(r?.steps).toHaveLength(2);
    expect(r?.isFavorite).toBe(false);
    expect(listRecipes(db)).toHaveLength(1);
  });

  it("actualiza reemplazando ingredientes e informa de la foto anterior", () => {
    const id = createRecipe(tortilla(), "11111111-1111-1111-1111-111111111111.jpg", db);
    const changed = { ...tortilla(), ingredients: [{ quantity: 1, unit: null, name: "cebolla", note: null, group: null }] };
    const res = updateRecipe(id, changed, null, db);
    expect(res).toEqual({ previousPhoto: "11111111-1111-1111-1111-111111111111.jpg" });
    const r = getRecipe(id, db);
    expect(r?.ingredients.map((i) => i.name)).toEqual(["cebolla"]);
    expect(r?.photo).toBeNull();
  });

  it("no toca la foto si se pasa undefined", () => {
    const id = createRecipe(tortilla(), "22222222-2222-2222-2222-222222222222.png", db);
    expect(updateRecipe(id, tortilla(), undefined, db)).toEqual({ previousPhoto: null });
    expect(getRecipe(id, db)?.photo).toBe("22222222-2222-2222-2222-222222222222.png");
  });

  it("valoración y favorito", () => {
    const id = createRecipe(tortilla(), null, db);
    setRating(id, 5, db);
    setFavorite(id, true, db);
    expect(getRecipe(id, db)).toMatchObject({ rating: 5, isFavorite: true });
  });

  it("borra en cascada", () => {
    const id = createRecipe(tortilla(), null, db);
    expect(deleteRecipe(id, db)).toEqual({ photo: null });
    expect(getRecipe(id, db)).toBeNull();
    expect(deleteRecipe(id, db)).toBe(false);
    expect(updateRecipe(id, tortilla(), undefined, db)).toBe(false);
  });
});
