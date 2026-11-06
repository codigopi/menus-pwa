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
import { generateWeek, regenerateSlot, setDaySingleCourse } from "./service";

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
  it("por defecto: comida con primero y segundo + cena (21 platos)", () => {
    generateWeek("2026-11-02", { ...DEFAULT_PARAMS, adults: 3 }, 1, db);
    const plan = getPlan("2026-11-02", db)!;
    expect(plan.slots).toHaveLength(21);
    expect(plan.slots.slice(0, 3)).toMatchObject([
      { date: "2026-11-02", meal: "comida", course: "primero" },
      { date: "2026-11-02", meal: "comida", course: "segundo" },
      { date: "2026-11-02", meal: "cena", course: "unico" },
    ]);
    expect(plan.slots.every((s) => s.recipeId)).toBe(true);
    expect(latestParams(db).adults).toBe(3);
  });

  it("comida de plato único en ajustes: 14 platos", () => {
    generateWeek("2026-11-02", { ...DEFAULT_PARAMS, lunchCourses: "unico" }, 1, db);
    const plan = getPlan("2026-11-02", db)!;
    expect(plan.slots).toHaveLength(14);
    expect(plan.slots.every((s) => s.course === "unico")).toBe(true);
  });

  it("un día concreto de plato único (y vuelta a dos platos) sin tocar el resto", () => {
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const before = getPlan("2026-11-02", db)!;
    setDaySingleCourse("2026-11-02", "2026-11-07", true, 5, db);
    const after = getPlan("2026-11-02", db)!;
    expect(after.singleCourseDays).toEqual(["2026-11-07"]);
    expect(after.slots).toHaveLength(20);
    const saturday = after.slots.filter((s) => s.date === "2026-11-07" && s.meal === "comida");
    expect(saturday).toMatchObject([{ course: "unico" }]);
    expect(saturday[0].recipeId).not.toBeNull();
    // El resto de la semana, intacto (mismos huecos y recetas)
    const others = (p: typeof before) => p.slots.filter((s) => !(s.date === "2026-11-07" && s.meal === "comida")).map((s) => `${s.id}:${s.recipeId}`);
    expect(others(after)).toEqual(others(before));

    // Se recuerda al regenerar y se puede deshacer
    generateWeek("2026-11-02", DEFAULT_PARAMS, 9, db);
    expect(getPlan("2026-11-02", db)!.slots.filter((s) => s.date === "2026-11-07" && s.meal === "comida")).toHaveLength(1);
    setDaySingleCourse("2026-11-02", "2026-11-07", false, 5, db);
    expect(getPlan("2026-11-02", db)!.slots.filter((s) => s.date === "2026-11-07" && s.meal === "comida").map((s) => s.course)).toEqual(["primero", "segundo"]);
  });

  it("regenerar conserva el id de los huecos (no se pierde el «cocinado»)", () => {
    generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
    const ids = getPlan("2026-11-02", db)!.slots.map((s) => s.id);
    generateWeek("2026-11-02", DEFAULT_PARAMS, 2, db);
    expect(getPlan("2026-11-02", db)!.slots.map((s) => s.id)).toEqual(ids);
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
    expect(saveParams("2026-11-09", { ...DEFAULT_PARAMS, adults: 4 }, db)).toEqual({ hasPlan: false });
    expect(latestParams(db).adults).toBe(4);
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
