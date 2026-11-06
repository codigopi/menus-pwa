/**
 * Integración menú + BD en memoria: generar, bloquear, regenerar,
 * recetas recientes y borrado de recetas usadas en el menú.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type AppDb } from "@/lib/db";
import { DEFAULT_PARAMS } from "@/lib/domain/menu";
import { recipeInputSchema } from "@/lib/domain/recipe";
import { createRecipe, deleteRecipe } from "@/lib/recipes/repo";
import { getPlan, latestParams, recentRecipes, saveParams, updateSlot } from "./repo";
import { generateWeek, regenerateSlot } from "./service";

let db: AppDb;

const make = (title: string, ingredients: string[]) =>
  createRecipe(
    recipeInputSchema.parse({
      title,
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 20,
      tags: [],
      ingredients: ingredients.map((name) => ({ quantity: 1, unit: null, name })),
      steps: [],
      rating: null,
    }),
    null,
    db,
  );

beforeEach(() => {
  db = openDb(":memory:");
  for (const [t, i] of [
    ["Lentejas", ["lentejas"]], ["Garbanzos", ["garbanzos"]], ["Merluza", ["merluza"]], ["Salmón", ["salmón"]],
    ["Pollo", ["pollo"]], ["Albóndigas", ["carne picada"]], ["Tortilla", ["huevos"]], ["Revuelto", ["huevos", "setas"]],
    ["Macarrones", ["macarrones"]], ["Arroz", ["arroz"]], ["Pisto", ["calabacín"]], ["Crema", ["calabaza"]],
    ["Ensalada", ["lechuga"]], ["Alubias", ["alubias"]],
  ] as const) make(t, [...i]);
});

describe("servicio de menú", () => {
  it("genera 14 huecos y guarda los parámetros", () => {
    generateWeek("2026-11-02", { ...DEFAULT_PARAMS, people: 3 }, 1, db);
    const plan = getPlan("2026-11-02", db)!;
    expect(plan.slots).toHaveLength(14);
    expect(plan.slots[0]).toMatchObject({ date: "2026-11-02", meal: "comida" });
    expect(plan.slots[1]).toMatchObject({ date: "2026-11-02", meal: "cena" });
    expect(plan.slots.every((s) => s.recipeId)).toBe(true);
    expect(latestParams(db).people).toBe(3);
  });

  it("al regenerar conserva los huecos bloqueados (receta o texto)", () => {
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const before = getPlan("2026-11-02", db)!;
    updateSlot(before.slots[0].id, { locked: true }, db);
    updateSlot(before.slots[1].id, { locked: true, recipeId: null, freeText: "Comer fuera" }, db);

    generateWeek("2026-11-02", DEFAULT_PARAMS, 999, db);
    const after = getPlan("2026-11-02", db)!;
    expect(after.slots[0].recipeId).toBe(before.slots[0].recipeId);
    expect(after.slots[1]).toMatchObject({ freeText: "Comer fuera", recipeId: null, locked: true });
    const changed = after.slots.slice(2).filter((s, i) => s.recipeId !== before.slots[i + 2].recipeId).length;
    expect(changed).toBeGreaterThanOrEqual(6); // regenerar cambia de verdad
  });

  it("solo cenas: crea 7 huecos", () => {
    generateWeek("2026-11-02", { ...DEFAULT_PARAMS, meals: ["cena"] }, 1, db);
    expect(getPlan("2026-11-02", db)!.slots.every((s) => s.meal === "cena")).toBe(true);
    expect(getPlan("2026-11-02", db)!.slots).toHaveLength(7);
  });

  it("regenerar un hueco cambia solo ese", () => {
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const before = getPlan("2026-11-02", db)!;
    regenerateSlot(before.slots[4].id, 7, db);
    const after = getPlan("2026-11-02", db)!;
    expect(after.slots[4].recipeId).not.toBe(before.slots[4].recipeId);
    after.slots.forEach((s, i) => i !== 4 && expect(s.recipeId).toBe(before.slots[i].recipeId));
  });

  it("recentRecipes mira las dos semanas anteriores", () => {
    generateWeek("2026-10-26", DEFAULT_PARAMS, 1, db);
    const recent = recentRecipes("2026-11-02", 14, db);
    expect(recent.size).toBe(14);
    expect(Math.min(...recent.values())).toBe(1); // domingo anterior
    expect(Math.max(...recent.values())).toBe(7); // lunes anterior
  });

  it("los ajustes se guardan sin regenerar y valen para semanas nuevas", () => {
    // Sin menú: queda como preferencia
    expect(saveParams("2026-11-09", { ...DEFAULT_PARAMS, people: 4 }, db)).toEqual({ hasPlan: false });
    expect(latestParams(db).people).toBe(4);
    expect(getPlan("2026-11-09", db)).toBeNull();

    // Con menú: se guardan en el menú pero los platos no cambian
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const before = getPlan("2026-11-02", db)!;
    expect(saveParams("2026-11-02", { ...DEFAULT_PARAMS, vegetarian: true }, db)).toEqual({ hasPlan: true });
    const after = getPlan("2026-11-02", db)!;
    expect(after.params.vegetarian).toBe(true);
    expect(after.slots.map((s) => s.recipeId)).toEqual(before.slots.map((s) => s.recipeId));
    expect(latestParams(db).vegetarian).toBe(true);
  });

  it("borrar una receta deja su hueco vacío, sin romper el menú", () => {
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const plan = getPlan("2026-11-02", db)!;
    deleteRecipe(plan.slots[0].recipeId!, db);
    expect(getPlan("2026-11-02", db)!.slots[0].recipeId).toBeNull();
  });
});
