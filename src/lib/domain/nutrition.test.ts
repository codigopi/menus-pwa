import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nutritionFlags, weeklyBalance, type DishForBalance, type NutritionRecipe } from "./nutrition";

const R = (title: string, ingredients: (string | [string, string])[], tags: string[] = []): NutritionRecipe => ({
  title,
  tags,
  ingredients: ingredients.map((i) => (Array.isArray(i) ? { name: i[0], note: i[1] } : { name: i })),
});

describe("señales nutricionales por receta", () => {
  it.each([
    [R("Pechugas de pollo empanadas", ["pechuga de pollo", "huevos", "pan rallado", ["aceite de girasol", "para freír"]]), { category: "carne", meat: "blanca", fried: true, processedMeat: false }],
    [R("Filetes de solomillo de cerdo", ["solomillo de cerdo", "ajo"]), { category: "carne", meat: "roja", fried: false }],
    [R("Lentejas", ["lentejas", "zanahoria", "chorizo"]), { category: "legumbre", meat: null, processedMeat: true, vegetables: true }],
    [R("Judías verdes con patata", ["judías verdes", "patatas"]), { category: "verdura", vegetables: true, processedMeat: false }],
    [R("Salmón al horno", ["salmón", "patatas"]), { category: "pescado", oilyFish: true, vegetables: false }],
    [R("Merluza a la plancha", ["merluza", "ajo", "perejil"]), { category: "pescado", oilyFish: false, vegetables: false }],
    [R("Hamburguesas de pescado", ["hamburguesas de pescado", "pan de hamburguesa", "lechuga"], ["pescado"]), { category: "pescado", processedMeat: false, fastFood: true, vegetables: true }],
    [R("Pizza", ["masa de pizza", "tomate frito", "mozzarella", "jamón cocido"]), { fastFood: true, processedMeat: true }],
    [R("Nuggets de pollo con patatas", ["nuggets de pollo", "patatas"]), { fastFood: true, fried: true }],
    [R("Pez espada a la plancha", ["pez espada"]), { highMercury: true }],
    [R("Atún con tomate", ["atún", "tomate"]), { highMercury: false, oilyFish: true }],
  ] as const)("%s", (recipe, expected) => {
    expect(nutritionFlags(recipe)).toMatchObject(expected);
  });
});

const dish = (date: string, meal: "comida" | "cena", recipe: NutritionRecipe): DishForBalance => ({ date, meal, flags: nutritionFlags(recipe) });

describe("equilibrio semanal", () => {
  const D = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const lentejas = R("Lentejas", ["lentejas", "zanahoria"]);
  const merluza = R("Merluza", ["merluza"]);
  const salmon = R("Salmón", ["salmón"]);
  const tortilla = R("Tortilla", ["huevos", "patatas"]);
  const pollo = R("Pollo asado", ["pollo"]);
  const ensalada = R("Ensalada", ["lechuga", "tomate"]);
  const pizza = R("Pizza", ["masa de pizza", "jamón cocido"]);

  it("una semana equilibrada cumple todo", () => {
    const week = [
      dish(D[0], "comida", lentejas), dish(D[0], "cena", merluza),
      dish(D[1], "comida", ensalada), dish(D[1], "cena", tortilla),
      dish(D[2], "comida", lentejas), dish(D[2], "cena", salmon),
      dish(D[3], "comida", ensalada), dish(D[3], "cena", pollo),
      dish(D[4], "comida", lentejas), dish(D[4], "cena", tortilla),
      dish(D[5], "comida", ensalada), dish(D[5], "cena", merluza),
      dish(D[6], "comida", ensalada), dish(D[6], "cena", pizza),
    ];
    const res = weeklyBalance(week);
    expect(res.filter((r) => r.status !== "ok").map((r) => r.id)).toEqual([]);
  });

  it("detecta lo que falta y lo que sobra, con consejo", () => {
    const week = D.flatMap((d) => [dish(d, "comida", pollo), dish(d, "cena", pizza)]);
    const byId = Object.fromEntries(weeklyBalance(week).map((r) => [r.id, r]));
    expect(byId.legumbre).toMatchObject({ status: "bajo", count: 0, min: 3 });
    expect(byId.pescado.status).toBe("bajo");
    // 7 de pollo + 7 pizzas con jamón (también cuentan como carne)
    expect(byId.carne).toMatchObject({ status: "alto", count: 14, max: 4 });
    expect(byId.rapida).toMatchObject({ status: "alto", count: 7 });
    expect(byId.verdura_diaria.status).toBe("bajo");
    expect(byId.rapida.advice).toContain("ocasional");
  });

  it("escala los objetivos si el menú tiene menos días", () => {
    const res = weeklyBalance([dish(D[0], "comida", lentejas), dish(D[1], "comida", lentejas), dish(D[2], "comida", merluza)]);
    const leg = res.find((r) => r.id === "legumbre")!;
    expect(leg).toMatchObject({ min: 1, max: 2, status: "ok" });
  });
});

describe("los platos habituales de la casa", () => {
  const { recetas } = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/platos-habituales.json"), "utf8")) as {
    recetas: { title: string; tags: string[]; ingredients: [number | null, string | null, string, string?][] }[];
  };
  const flags = (t: string) => {
    const p = recetas.find((r) => r.title === t)!;
    return nutritionFlags({ title: p.title, tags: p.tags, ingredients: p.ingredients.map(([, , name, note]) => ({ name, note })) });
  };

  it("se clasifican con sentido", () => {
    expect(flags("Pechugas de pollo empanadas")).toMatchObject({ meat: "blanca", fried: true });
    expect(flags("Lomo adobado a la plancha")).toMatchObject({ meat: "roja", fried: false });
    expect(flags("Libritos de lomo")).toMatchObject({ fried: true, processedMeat: true });
    expect(flags("Judías verdes con chorizo")).toMatchObject({ vegetables: true, processedMeat: true });
    expect(flags("Perrito caliente")).toMatchObject({ fastFood: true, processedMeat: true });
    expect(flags("Alitas de pollo con patatas")).toMatchObject({ meat: "blanca", fried: false });
    expect(flags("Lubina al horno")).toMatchObject({ category: "pescado", oilyFish: false });
  });
});
