import { describe, expect, it } from "vitest";
import { buildTasteProfile, describeProfile, rankedCategories, rediscover, tasteScore, type TasteLog, type TasteRecipe } from "./taste";

const R = (id: string, ingredients: string[], extra: Partial<TasteRecipe> = {}): TasteRecipe => ({
  id,
  title: id,
  tags: [],
  rating: null,
  isFavorite: false,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: ingredients.map((name) => ({ name })),
  ...extra,
});
const L = (recipeId: string, cookedOn: string, rating: number | null = null): TasteLog => ({ recipeId, cookedOn, rating });

const TODAY = "2026-11-06";
const recipes = [
  R("lentejas", ["lentejas", "chorizo", "cebolla", "pimentón"], { rating: 5 }),
  R("garbanzos", ["garbanzos", "espinacas"], { isFavorite: true }),
  R("hummus", ["garbanzos", "tahini"]),
  R("merluza", ["merluza", "patata"], { rating: 2 }),
  R("salmon", ["salmón", "patata"]),
  R("pisto", ["calabacín", "pimiento"]),
];
const logs = [L("lentejas", "2026-10-01", 5), L("garbanzos", "2026-11-01", 5), L("garbanzos", "2026-10-15"), L("merluza", "2026-10-20", 1)];

describe("perfil de gustos", () => {
  const p = buildTasteProfile(recipes, logs, TODAY);

  it("aprende qué tipos de plato e ingredientes gustan", () => {
    expect(p.signals).toBe(3); // lentejas, garbanzos, merluza
    expect(rankedCategories(p)[0].category).toBe("legumbre");
    expect(p.categories.pescado).toBeLessThan(0);
    expect(p.liked).toContain("garbanzos");
    expect(p.disliked).toContain("merluza");
    expect(p.liked).not.toContain("cebolla"); // ingrediente neutro
    expect(p.liked).not.toContain("pimentón"); // las especias no cuentan
  });

  it("puntúa recetas nuevas por parecido", () => {
    expect(tasteScore(recipes.find((r) => r.id === "hummus")!, p)).toBeGreaterThan(0);
    expect(tasteScore(recipes.find((r) => r.id === "salmon")!, p)).toBeLessThan(0);
    expect(tasteScore(recipes[0], buildTasteProfile(recipes, [], TODAY))).toBeGreaterThan(-2);
  });

  it("sin señales, todo neutro", () => {
    const empty = buildTasteProfile(recipes.map((r) => ({ ...r, rating: null, isFavorite: false })), [], TODAY);
    expect(empty.signals).toBe(0);
    expect(tasteScore(recipes[0], empty)).toBe(0);
    expect(describeProfile(empty)).toContain("pocas valoraciones");
  });

  it("describe el perfil para la IA", () => {
    const text = describeProfile(p);
    expect(text).toContain("legumbre");
    expect(text).toContain("garbanzos");
  });

  it("propone redescubrir: encaja con los gustos y no se ha hecho hace poco", () => {
    const sug = rediscover(recipes, logs, p, TODAY);
    const ids = sug.map((s) => s.recipeId);
    expect(ids).not.toContain("garbanzos"); // cocinados hace 5 días
    // Arriba: las lentejas (5★, hace 36 días) y el hummus (sin estrenar, con garbanzos)
    expect(ids.slice(0, 2).sort()).toEqual(["hummus", "lentejas"]);
    expect(sug.find((s) => s.recipeId === "lentejas")?.reason).toBe("Hace 36 días que no la hacéis");
    expect(sug.find((s) => s.recipeId === "hummus")?.reason).toContain("legumbre");
    // El pescado gusta poco: el salmón no se propone (o queda por detrás del pisto)
    expect(!ids.includes("salmon") || ids.indexOf("salmon") > ids.indexOf("pisto")).toBe(true);
  });
});
