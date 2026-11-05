import { describe, expect, it } from "vitest";
import { heads, ingredientMatches, matchRecipes, singular, tokens, type MatchableRecipe } from "./matching";

describe("normalización", () => {
  it.each([
    ["tomates", "tomate"],
    ["patatas", "patata"],
    ["limones", "limon"],
    ["panes", "pan"],
    ["nueces", "nuez"],
    ["guisantes", "guisante"],
    ["champinones", "champinon"],
    ["arroz", "arroz"],
    ["ajo", "ajo"],
    ["gas", "gas"],
  ])("singular(%s) = %s", (w, s) => expect(singular(w)).toBe(s));

  it("tokens quita tildes, conectores y pasa a singular", () => {
    expect(tokens("Aceite de Oliva Virgen Extra")).toEqual(["aceite", "oliva", "virgen", "extra"]);
    expect(tokens("Champiñones laminados")).toEqual(["champinon", "laminado"]);
    expect(tokens("Papas")).toEqual(["patata"]);
  });

  it("heads: núcleo y animal en los cortes", () => {
    expect(heads("caldo de pollo")).toEqual(["caldo"]);
    expect(heads("pechuga de pollo")).toEqual(["pechuga", "pollo"]);
    expect(heads("pimiento rojo")).toEqual(["pimiento"]);
  });
});

describe("ingredientMatches", () => {
  it.each([
    ["patatas", "patata", true],
    ["huevos", "huevo L", true],
    ["tomate", "tomate triturado", true],
    ["pimiento", "pimiento rojo", true],
    ["pollo", "pechuga de pollo", true],
    ["pollo", "caldo de pollo", false],
    ["aceite", "aceite de oliva virgen extra", true],
    ["AOVE", "aceite de oliva", true],
    ["papas", "patatas", true],
    ["cebolla", "cebolleta", false],
    ["queso", "queso rallado", true],
    ["leche", "leche de coco", true], // límite conocido: mismo núcleo
  ])("%s ↔ %s = %s", (have, need, expected) => expect(ingredientMatches(have, need)).toBe(expected));
});

const r = (id: string, ingredients: string[], extra: Partial<MatchableRecipe> = {}): MatchableRecipe => ({
  id,
  title: id,
  tags: [],
  rating: null,
  ingredients: ingredients.map((name) => {
    const minor = name.endsWith("*");
    return { name: name.replace("*", ""), quantity: minor ? null : 1, unit: null, note: null };
  }),
  ...extra,
});

describe("matchRecipes", () => {
  const recipes = [
    r("tortilla", ["huevos", "patatas", "cebolla", "aceite de oliva", "sal*"]),
    r("revuelto", ["huevos", "champiñones", "ajo", "perejil*"]),
    r("lentejas", ["lentejas", "chorizo", "cebolla", "zanahoria"]),
    r("pisto", ["calabacín", "pimiento", "tomate", "cebolla"], { tags: ["aprovechamiento"] }),
  ];

  it("ordena por menos faltas y dice qué falta", () => {
    const res = matchRecipes(recipes, ["huevo", "patata", "cebolla"]);
    expect(res.map((m) => m.recipe.id)).toEqual(["tortilla", "revuelto", "pisto", "lentejas"]);
    expect(res[0]).toMatchObject({ missing: [], used: ["huevo", "patata", "cebolla"] });
    expect(res[1]).toMatchObject({ missing: ["champiñones", "ajo"], missingMinor: ["perejil"] });
  });

  it("los básicos no cuentan como falta y se pueden personalizar", () => {
    const sinAceite = matchRecipes(recipes, ["huevo", "patata", "cebolla"], ["sal"]);
    expect(sinAceite[0].missing).toEqual(["aceite de oliva"]);
  });

  it("solo devuelve recetas que usan algo mío", () => {
    expect(matchRecipes(recipes, ["salmón"])).toEqual([]);
    expect(matchRecipes(recipes, [])).toEqual([]);
  });

  it("a igualdad de faltas, prioriza aprovechamiento", () => {
    const res = matchRecipes(
      [r("a", ["tomate", "queso"]), r("b", ["tomate", "queso"], { tags: ["aprovechamiento"] })],
      ["tomate"],
    );
    expect(res.map((m) => m.recipe.id)).toEqual(["b", "a"]);
  });
});
