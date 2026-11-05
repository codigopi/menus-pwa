import { describe, expect, it } from "vitest";
import { formatMinutes, normalizeTags, recipeInputSchema, totalMinutes } from "./recipe";
import { emptyIngredient, emptyRecipeForm, formToRecipeInput, newKey, recipeToForm } from "./recipe-form";

const baseForm = () => ({
  ...emptyRecipeForm(),
  title: "  Lentejas estofadas ",
  prepMinutes: "10",
  cookMinutes: "40",
  tags: ["Cuchara", "cuchara ", "Legumbres"],
  ingredients: [
    { ...emptyIngredient(), quantity: "300", unit: "g" as const, name: "lentejas pardinas" },
    { key: newKey(), kind: "section" as const, label: "Para el sofrito" },
    { ...emptyIngredient(), quantity: "1", unit: "ud" as const, name: "cebolla" },
    { ...emptyIngredient(), quantity: "2", unit: "diente" as const, name: "ajo", note: "picados" },
    { ...emptyIngredient(), quantity: "", unit: "" as const, name: "sal" },
    emptyIngredient(), // fila vacía: se ignora
  ],
  steps: [
    { key: newKey(), text: "Sofreír la verdura." },
    { key: newKey(), text: "  " },
    { key: newKey(), text: "Añadir las lentejas y cubrir de agua." },
  ],
});

describe("formToRecipeInput + esquema", () => {
  it("convierte un formulario completo en una receta válida", () => {
    const conv = formToRecipeInput(baseForm());
    expect(conv.ok).toBe(true);
    if (!conv.ok) return;

    const recipe = recipeInputSchema.parse(conv.data);
    expect(recipe.title).toBe("Lentejas estofadas");
    expect(recipe.tags).toEqual(["cuchara", "legumbres"]);
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.ingredients).toHaveLength(4);
    expect(recipe.ingredients[0]).toMatchObject({ name: "lentejas pardinas", group: null, quantity: 300 });
    expect(recipe.ingredients[1]).toMatchObject({ name: "cebolla", group: "Para el sofrito" });
    expect(recipe.ingredients[2].note).toBe("picados");
    expect(recipe.ingredients[3]).toMatchObject({ name: "sal", quantity: null, unit: null });
    expect(recipe.sourceUrl).toBeNull();
  });

  it("avisa de cantidades ilegibles", () => {
    const form = baseForm();
    form.ingredients[0] = { ...emptyIngredient(), quantity: "un montón", name: "arroz" };
    const conv = formToRecipeInput(form);
    expect(conv.ok).toBe(false);
    if (!conv.ok) expect(conv.errors[0]).toContain("un montón");
  });

  it("rechaza título vacío y enlaces inválidos", () => {
    const conv = formToRecipeInput({ ...baseForm(), title: " ", sourceUrl: "no es un enlace" });
    if (!conv.ok) throw new Error("conversión inesperada");
    const res = recipeInputSchema.safeParse(conv.data);
    expect(res.success).toBe(false);
  });

  it("ida y vuelta: receta → formulario → receta conserva los datos", () => {
    const conv = formToRecipeInput(baseForm());
    if (!conv.ok) throw new Error("conversión inesperada");
    const original = recipeInputSchema.parse(conv.data);
    const again = formToRecipeInput(recipeToForm(original));
    if (!again.ok) throw new Error("conversión inesperada");
    expect(recipeInputSchema.parse(again.data)).toEqual(original);
  });
});

describe("utilidades", () => {
  it("normalizeTags limpia, pasa a minúsculas y deduplica", () => {
    expect(normalizeTags([" Horno", "horno", "", "Batch   cooking"])).toEqual(["horno", "batch cooking"]);
  });

  it("totalMinutes y formatMinutes", () => {
    expect(totalMinutes({ prepMinutes: 15, cookMinutes: null })).toBe(15);
    expect(totalMinutes({ prepMinutes: null, cookMinutes: null })).toBeNull();
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(80)).toBe("1 h 20 min");
  });
});
