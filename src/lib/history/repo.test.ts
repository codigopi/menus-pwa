import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type AppDb } from "@/lib/db";
import { DEFAULT_PARAMS } from "@/lib/domain/menu";
import { recipeInputSchema } from "@/lib/domain/recipe";
import { getPlan } from "@/lib/menu/repo";
import { generateWeek } from "@/lib/menu/service";
import { createRecipe, deleteRecipe, getRecipe } from "@/lib/recipes/repo";
import { addCookLog, cookedRecently, cookedSlotIds, deleteCookLog, listCookLogs, logsForRecipe } from "./repo";

let db: AppDb;
let id: string;

beforeEach(() => {
  db = openDb(":memory:");
  id = createRecipe(
    recipeInputSchema.parse({ title: "Lentejas", servings: 4, prepMinutes: 5, cookMinutes: 30, tags: [], ingredients: [{ quantity: 300, unit: "g", name: "lentejas" }], steps: [], rating: null }),
    null,
    db,
  );
});

describe("histórico", () => {
  it("registra, guarda notas y la valoración de la receta es la media", () => {
    addCookLog({ recipeId: id, cookedOn: "2026-11-01", rating: 5, notes: " menos sal " }, db);
    addCookLog({ recipeId: id, cookedOn: "2026-11-05", rating: 3 }, db);
    expect(getRecipe(id, db)?.rating).toBe(4);
    expect(logsForRecipe(id, db).map((l) => l.notes)).toEqual([null, "menos sal"]);

    deleteCookLog(logsForRecipe(id, db)[0].id, db);
    expect(getRecipe(id, db)?.rating).toBe(5);
  });

  it("sin valoración no toca la de la receta", () => {
    addCookLog({ recipeId: id, cookedOn: "2026-11-01" }, db);
    expect(getRecipe(id, db)?.rating).toBeNull();
  });

  it("cocinado reciente para el planificador", () => {
    addCookLog({ recipeId: id, cookedOn: "2026-10-30" }, db);
    expect(cookedRecently("2026-11-02", 14, db).get(id)).toBe(3);
    expect(cookedRecently("2026-12-01", 14, db).has(id)).toBe(false);
  });

  it("marcar desde el menú: una vez por hueco", () => {
    generateWeek("2026-11-02", { ...DEFAULT_PARAMS, meals: ["comida"] }, 1, db);
    const slot = getPlan("2026-11-02", db)!.slots[0];
    addCookLog({ recipeId: id, cookedOn: slot.date, slotId: slot.id, rating: 4 }, db);
    addCookLog({ recipeId: id, cookedOn: slot.date, slotId: slot.id, rating: 5 }, db);
    expect(listCookLogs(100, db)).toHaveLength(1);
    expect(cookedSlotIds([{ id: slot.id, recipeId: id }], db).has(slot.id)).toBe(true);
    // Si el hueco cambia de plato, deja de contar como cocinado
    expect(cookedSlotIds([{ id: slot.id, recipeId: "otra" }], db).has(slot.id)).toBe(false);
  });

  it("borrar la receta conserva el histórico con su título", () => {
    addCookLog({ recipeId: id, cookedOn: "2026-11-01" }, db);
    deleteRecipe(id, db);
    expect(listCookLogs(100, db)[0]).toMatchObject({ recipeId: null, recipeTitle: "Lentejas" });
  });

  it("receta inexistente: no registra", () => {
    expect(addCookLog({ recipeId: "nope", cookedOn: "2026-11-01" }, db)).toBeNull();
  });
});
