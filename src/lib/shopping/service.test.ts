/**
 * Integración: menú → lista de la compra, despensa, regenerar y cambios offline.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type AppDb } from "@/lib/db";
import { DEFAULT_PARAMS } from "@/lib/domain/menu";
import { recipeInputSchema } from "@/lib/domain/recipe";
import { getPlan, updateSlot } from "@/lib/menu/repo";
import { generateWeek } from "@/lib/menu/service";
import { createRecipe } from "@/lib/recipes/repo";
import { addPantryItem, applyOps, currentFingerprint, generateList, getList, listPantry } from "./service";

let db: AppDb;
const WEEK = "2026-11-02";

const make = (title: string, servings: number, ingredients: [number | null, string | null, string][]) =>
  createRecipe(
    recipeInputSchema.parse({
      title,
      servings,
      prepMinutes: 10,
      cookMinutes: 20,
      tags: [],
      ingredients: ingredients.map(([quantity, unit, name]) => ({ quantity, unit, name })),
      steps: [],
      rating: null,
    }),
    null,
    db,
  );

beforeEach(() => {
  db = openDb(":memory:");
  make("Tortilla", 4, [[6, null, "huevos"], [600, "g", "patatas"], [1, null, "cebolla"], [null, null, "sal"]]);
  make("Lentejas", 4, [[300, "g", "lentejas"], [1, null, "cebolla"], [1, null, "chorizo"]]);
  // Un menú de solo 2 platos para que las cantidades sean predecibles
  generateWeek(WEEK, { ...DEFAULT_PARAMS, meals: ["comida"], people: 2, maxMinutesWeekday: null }, 1, db);
  const plan = getPlan(WEEK, db)!;
  plan.slots.forEach((s, i) => i > 1 && updateSlot(s.id, { recipeId: null, freeText: "Comer fuera", locked: true }, db));
});

const item = (key: string) => getList(WEEK, db)!.items.find((i) => i.key === key);

describe("lista de la compra", () => {
  it("se genera desde el menú, escalada a las personas y fusionada", () => {
    expect(generateList(WEEK, db)).toBe(true);
    // 2 personas / recetas de 4 → mitad de todo
    expect(item("huevo")?.amount).toBe("3 uds");
    expect(item("patata")?.amount).toBe("300 g");
    expect(item("cebolla")).toMatchObject({ amount: "1 ud", sources: expect.arrayContaining(["Tortilla", "Lentejas"]) });
    expect(item("lenteja")?.section).toBe("despensa");
  });

  it("sin menú no genera nada", () => {
    expect(generateList("2030-01-07", db)).toBe(false);
  });

  it("la despensa se resta y cambia la huella", () => {
    generateList(WEEK, db);
    const before = currentFingerprint(WEEK, db);
    addPantryItem("lentejas", db); // sin cantidad: tengo de sobra
    addPantryItem("2 huevos", db);
    expect(listPantry(db)).toHaveLength(2);
    expect(currentFingerprint(WEEK, db)).not.toBe(before); // la lista queda desactualizada

    generateList(WEEK, db);
    expect(item("lenteja")).toBeUndefined();
    expect(item("huevo")).toMatchObject({ amount: "1 ud", pantryNote: "Tienes 2 uds" });
    expect(getList(WEEK, db)!.list.covered.map((c) => c.key)).toContain("lenteja");
    expect(getList(WEEK, db)!.list.fingerprint).toBe(currentFingerprint(WEEK, db));
  });

  it("regenerar conserva lo manual y lo marcado", () => {
    generateList(WEEK, db);
    const huevo = item("huevo")!;
    applyOps(WEEK, [
      { type: "check", id: huevo.id, checked: true, at: Date.now() },
      { type: "add", id: "manual-1", text: "papel de cocina", at: Date.now() },
    ], db);
    generateList(WEEK, db);
    expect(item("huevo")?.checked).toBe(true);
    expect(item("papel cocina")).toMatchObject({ manual: true, section: "otros" });
  });

  it("los cambios offline son idempotentes y respetan el orden temporal", () => {
    generateList(WEEK, db);
    const huevo = item("huevo")!;
    const t = Date.now() + 1000;
    const ops = [
      { type: "add" as const, id: "m-2", text: "2 kg de naranjas", at: t },
      { type: "check" as const, id: huevo.id, checked: true, at: t + 10 },
    ];
    applyOps(WEEK, ops, db);
    applyOps(WEEK, ops, db); // reenvío tras un corte: no duplica
    expect(getList(WEEK, db)!.items.filter((i) => i.id === "m-2")).toHaveLength(1);
    expect(item("naranja")?.amount).toBe("2 kg");

    // Un "desmarcar" más antiguo no pisa el marcado posterior
    applyOps(WEEK, [{ type: "check", id: huevo.id, checked: false, at: t - 5000 }], db);
    expect(item("huevo")?.checked).toBe(true);

    applyOps(WEEK, [{ type: "delete", id: "m-2", at: t + 20 }], db);
    expect(item("naranja")).toBeUndefined();
  });
});
