import { describe, expect, it } from "vitest";
import { normalizeAiRecipe, type AiRecipe } from "./recipe-schema";

const base: AiRecipe = {
  is_recipe: true,
  problem: null,
  title: "  Tortilla de patatas ",
  description: "",
  servings: 4,
  prep_minutes: 10.4,
  cook_minutes: 9999,
  ingredients: [
    { quantity: 6, unit: null, name: "huevos", note: null, group: null },
    { quantity: 0, unit: "g", name: "sal", note: " ", group: null },
    { quantity: 700, unit: "g", name: "  ", note: null, group: null },
  ],
  steps: ["Pelar las patatas.", "  ", "Cuajar."],
  tags: ["Huevos", "huevos", "Rápida"],
  warnings: ["Las raciones son una estimación", ""],
};

describe("normalizeAiRecipe", () => {
  it("limpia y acota la respuesta de la IA", () => {
    const { draft, warnings } = normalizeAiRecipe(base, { sourceType: "instagram", sourceUrl: "https://instagram.com/p/x" });
    expect(draft.title).toBe("Tortilla de patatas");
    expect(draft.description).toBeNull();
    expect(draft.prepMinutes).toBe(10);
    expect(draft.cookMinutes).toBe(1440);
    expect(draft.ingredients).toHaveLength(2); // descarta el nombre vacío
    expect(draft.ingredients[1]).toMatchObject({ name: "sal", quantity: null, note: null });
    expect(draft.steps).toEqual([{ text: "Pelar las patatas." }, { text: "Cuajar." }]);
    expect(draft.tags).toEqual(["huevos", "rápida"]);
    expect(draft.sourceType).toBe("instagram");
    expect(warnings).toEqual(["Las raciones son una estimación"]);
  });

  it("pone 2 raciones y avisa si no venían", () => {
    const { draft, warnings } = normalizeAiRecipe({ ...base, servings: null, warnings: [] }, { sourceType: "texto", sourceUrl: null });
    expect(draft.servings).toBe(2);
    expect(warnings[0]).toContain("raciones");
  });

  it("título por defecto si viene vacío", () => {
    expect(normalizeAiRecipe({ ...base, title: " " }, { sourceType: "texto", sourceUrl: null }).draft.title).toBe("Receta importada");
  });
});
