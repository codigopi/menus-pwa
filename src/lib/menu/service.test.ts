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

  describe("plantilla semanal", () => {
    // 2026-11-02 es lunes: viernes = 06, sábado = 07
    const withTemplate = (pizzaId: string) => ({
      ...DEFAULT_PARAMS,
      template: [
        { day: 4, meal: "cena" as const, recipeId: pizzaId, text: null },
        { day: 5, meal: "cena" as const, recipeId: null, text: "Pedir a domicilio" as const },
        { day: 6, meal: "comida" as const, recipeId: null, text: "Comer fuera" as const },
      ],
    });
    const slot = (date: string, meal: string) => getPlan("2026-11-02", db)!.slots.filter((s) => s.date === date && s.meal === meal);

    it("los huecos de la plantilla salen puestos y bloqueados; el domingo es plato único", () => {
      const pizza = make("Pizza", ["masa de pizza", "mozzarella"]);
      generateWeek("2026-11-02", withTemplate(pizza), 1, db);
      expect(slot("2026-11-06", "cena")).toMatchObject([{ recipeId: pizza, locked: true }]);
      expect(slot("2026-11-07", "cena")).toMatchObject([{ recipeId: null, freeText: "Pedir a domicilio", locked: true }]);
      expect(slot("2026-11-08", "comida")).toMatchObject([{ course: "unico", freeText: "Comer fuera", locked: true }]);
      const plan = getPlan("2026-11-02", db)!;
      expect(plan.slots).toHaveLength(20);
      // La pizza no se repite en otros huecos
      expect(plan.slots.filter((s) => s.recipeId === pizza)).toHaveLength(1);
    });

    it("al regenerar se mantiene, salvo donde la familia ha fijado otra cosa", () => {
      const pizza = make("Pizza", ["masa de pizza", "mozzarella"]);
      const params = withTemplate(pizza);
      generateWeek("2026-11-02", params, 1, db);
      const [friday] = slot("2026-11-06", "cena");
      const other = getPlan("2026-11-02", db)!.slots.find((s) => s.recipeId && s.recipeId !== pizza)!.recipeId!;
      updateSlot(friday.id, { recipeId: other, freeText: null, locked: true }, db);
      generateWeek("2026-11-02", params, 2, db);
      expect(slot("2026-11-06", "cena")).toMatchObject([{ id: friday.id, recipeId: other }]);
      expect(slot("2026-11-07", "cena")).toMatchObject([{ freeText: "Pedir a domicilio" }]);
    });

    it("añadir una entrada y regenerar la aplica a la semana actual; las de recetas borradas se ignoran", () => {
      generateWeek("2026-11-02", DEFAULT_PARAMS, 1, db);
      const pizza = make("Pizza", ["masa de pizza", "mozzarella"]);
      generateWeek("2026-11-02", withTemplate(pizza), 2, db);
      expect(slot("2026-11-06", "cena")).toMatchObject([{ recipeId: pizza }]);
      deleteRecipe(pizza, db);
      generateWeek("2026-11-09", withTemplate(pizza), 1, db);
      const friday = getPlan("2026-11-09", db)!.slots.find((s) => s.date === "2026-11-13" && s.meal === "cena")!;
      expect(friday.recipeId).not.toBeNull();
      expect(friday.locked).toBe(false);
    });
  });
});
