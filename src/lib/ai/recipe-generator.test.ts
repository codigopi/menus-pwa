import { describe, expect, it, vi } from "vitest";
import { AiError } from "./recipe-extractor";
import { buildIdeasPrompt, generateIdeas, IDEAS_SYSTEM, type IdeasRequest } from "./recipe-generator";
import type { AiRecipe } from "./recipe-schema";

const idea = (title: string, extra: Partial<AiRecipe> = {}): AiRecipe => ({
  is_recipe: true,
  problem: null,
  title,
  description: "Un clásico de cuchara.",
  servings: 2,
  prep_minutes: 10,
  cook_minutes: 30,
  ingredients: [{ quantity: 200, unit: "g", name: "garbanzos cocidos", note: null, group: null }],
  steps: ["Rehogar.", "Cocer."],
  tags: ["Cuchara"],
  warnings: [],
  ...extra,
});

const base: IdeasRequest = {
  mode: "perfil",
  profileText: "Tipos de plato que más gustan: legumbre.",
  existingTitles: ["Lentejas estofadas"],
  people: 2,
};

describe("prompt de ideas", () => {
  it("el sistema pide originalidad y estilo casero", () => {
    expect(IDEAS_SYSTEM).toContain("ORIGINALES");
    expect(IDEAS_SYSTEM).toContain("No reproduzcas recetas");
  });

  it("por gustos incluye perfil, raciones y recetas existentes", () => {
    const p = buildIdeasPrompt(base);
    expect(p).toContain("platos nuevos");
    expect(p).toContain("legumbre");
    expect(p).toContain("Raciones: 2");
    expect(p).toContain("Lentejas estofadas");
  });

  it("con ingredientes y restricciones", () => {
    const p = buildIdeasPrompt({ ...base, mode: "ingredientes", ingredients: ["calabacín", "huevos"], vegetarian: true, avoid: ["cerdo"], maxMinutes: 30 });
    expect(p).toContain("calabacín, huevos");
    expect(p).toContain("aprovechamiento");
    expect(p).toContain("vegetariana");
    expect(p).toContain("cerdo");
    expect(p).toContain("30 minutos");
  });
});

describe("generateIdeas", () => {
  it("normaliza las ideas como recetas 'generadas' y descarta las vacías", async () => {
    const call = vi.fn().mockResolvedValue({ ideas: [idea("Garbanzos con calabaza"), idea(" ", {}), idea("Sin ingredientes", { ingredients: [] })] });
    const ideas = await generateIdeas(base, call);
    expect(call).toHaveBeenCalledOnce();
    expect(ideas).toHaveLength(1);
    expect(ideas[0].draft).toMatchObject({ title: "Garbanzos con calabaza", sourceType: "generada", tags: ["cuchara"] });
  });

  it("si no sale nada válido, error comprensible", async () => {
    await expect(generateIdeas(base, vi.fn().mockResolvedValue({ ideas: [] }))).rejects.toBeInstanceOf(AiError);
  });
});
