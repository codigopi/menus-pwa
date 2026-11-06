import { describe, expect, it } from "vitest";
import { historyStats, type LogLike, type RecipeLike } from "./history-stats";

const R = (id: string, ingredients: string[], rating: number | null = null): RecipeLike => ({
  id,
  title: id[0].toUpperCase() + id.slice(1),
  rating,
  tags: [],
  ingredients: ingredients.map((name) => ({ name })),
});
const L = (recipeId: string | null, cookedOn: string, rating: number | null = null, recipeTitle = recipeId ?? "Borrada"): LogLike => ({
  recipeId,
  recipeTitle,
  cookedOn,
  rating,
});

const recipes = [R("lentejas", ["lentejas"], 5), R("tortilla", ["huevos"], 4), R("merluza", ["merluza"], 4), R("pisto", ["calabacín"])];
const TODAY = "2026-11-06";

describe("historyStats", () => {
  const logs = [
    L("lentejas", "2026-11-04", 5),
    L("lentejas", "2026-10-20", 4),
    L("tortilla", "2026-11-01", 4),
    L("lentejas", "2026-09-01", 5),
    L("merluza", "2026-08-15", 3),
    L(null, "2026-11-02", null, "Receta borrada"),
  ];
  const s = historyStats(logs, recipes, TODAY);

  it("cuenta lo reciente y el mes en curso", () => {
    expect(s.last30).toBe(4); // 4, 20 oct, 1 y 2 nov
    expect(s.thisMonth).toBe(3);
  });

  it("lo más cocinado, incluidas recetas borradas", () => {
    expect(s.topCooked[0]).toEqual({ recipeId: "lentejas", title: "Lentejas", count: 3 });
    expect(s.topCooked.some((t) => t.title === "Receta borrada")).toBe(true);
  });

  it("mejor valorado por media al cocinarlo", () => {
    expect(s.bestRated.map((b) => b.recipeId)).toEqual(["lentejas", "tortilla"]);
    expect(s.bestRated[0].avg).toBeCloseTo(4.67, 1);
  });

  it("bien valoradas que hace mucho que no se hacen, y nunca cocinadas", () => {
    expect(s.missYou).toEqual([{ recipeId: "merluza", title: "Merluza", daysAgo: 83 }]);
    expect(s.neverCooked.map((n) => n.recipeId)).toEqual(["pisto"]);
  });

  it("tipos de plato de los últimos 30 días", () => {
    expect(s.categories).toEqual({ legumbre: 2, huevo: 1 });
  });

  it("sin histórico", () => {
    const empty = historyStats([], recipes, TODAY);
    expect(empty.last30).toBe(0);
    expect(empty.neverCooked).toHaveLength(4);
  });
});
