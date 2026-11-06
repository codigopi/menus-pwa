/**
 * Valida los platos habituales de la casa (scripts/platos-habituales.json):
 * que son recetas válidas y que el menú los colocará donde deben ir.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyRecipe, courseRole, fitsMeal } from "./menu";
import { nutritionFlags } from "./nutrition";
import { recipeInputSchema } from "./recipe";

interface Plato {
  title: string;
  tags: string[];
  prep: number | null;
  cook: number | null;
  ingredients: [number | null, string | null, string, string?][];
  steps: string[];
}

const load = (f: string) => (JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", f), "utf8")) as { recetas: Plato[] }).recetas;
const habituales = load("platos-habituales.json");
const sugeridos = load("platos-sugeridos.json");
const recetas = [...habituales, ...sugeridos];
const toRecipe = (p: Plato) => ({ tags: p.tags, ingredients: p.ingredients.map(([, , name]) => ({ name })) });

describe("platos habituales", () => {
  it.each(recetas.map((p) => [p.title, p] as const))("%s es una receta válida", (_t, p) => {
    const res = recipeInputSchema.safeParse({
      title: p.title,
      servings: 4,
      prepMinutes: p.prep,
      cookMinutes: p.cook,
      tags: p.tags,
      ingredients: p.ingredients.map(([quantity, unit, name, note]) => ({ quantity, unit, name, note: note ?? null })),
      steps: p.steps.map((text) => ({ text })),
      rating: null,
    });
    expect(res.success, JSON.stringify(res.error?.issues)).toBe(true);
  });

  it("primeros, segundos y plato único en su sitio; cenas solo de cena", () => {
    const byTitle = new Map(recetas.map((p) => [p.title, toRecipe(p)]));
    for (const t of ["Lentejas", "Judías blancas", "Sopa de cocido", "Arroz tres delicias", "Pasta con chorizo"]) {
      expect(courseRole(byTitle.get(t)!), t).toBe("primero");
      expect(fitsMeal(byTitle.get(t)!, "cena"), t).toBe(false);
    }
    for (const t of ["Lomo adobado a la plancha", "Gallo a la plancha", "Merluza a la plancha"]) expect(courseRole(byTitle.get(t)!), t).toBe("segundo");
    expect(courseRole(byTitle.get("Paella con pollo")!)).toBe("unico");
    for (const t of ["Tortilla de patata", "Pizza", "Perrito caliente"]) expect(fitsMeal(byTitle.get(t)!, "comida"), t).toBe(false);
  });

  it("tipos de plato coherentes para equilibrar la semana", () => {
    const cat = (t: string) => classifyRecipe(toRecipe(recetas.find((p) => p.title === t)!));
    expect(cat("Gallo a la plancha")).toBe("pescado");
    expect(cat("Hamburguesas de pescado")).toBe("pescado");
    expect(cat("Lentejas")).toBe("legumbre");
    expect(cat("Pasta con carne picada")).toBe("pasta_arroz");
    expect(cat("Pechugas de pollo empanadas")).toBe("carne");
    expect(cat("Tortilla de patata")).toBe("huevo");
  });
});

describe("platos sugeridos para la pirámide", () => {
  const flags = (p: Plato) => nutritionFlags({ title: p.title, tags: p.tags, ingredients: p.ingredients.map(([, , name, note]) => ({ name, note })) });

  it("no repiten títulos de los habituales y llevan la etiqueta 'sugerida'", () => {
    const titles = new Set(habituales.map((p) => p.title.toLowerCase()));
    for (const p of sugeridos) {
      expect(titles.has(p.title.toLowerCase()), p.title).toBe(false);
      expect(p.tags, p.title).toContain("sugerida");
    }
    expect(new Set(recetas.map((p) => p.title.toLowerCase())).size).toBe(recetas.length);
  });

  it("cubren lo que faltaba: pescado azul, segundos de huevo, más legumbres y cenas con verdura", () => {
    expect(sugeridos.filter((p) => flags(p).oilyFish).length).toBeGreaterThanOrEqual(4);
    expect(sugeridos.filter((p) => classifyRecipe(toRecipe(p)) === "huevo" && courseRole(toRecipe(p)) === "segundo").length).toBeGreaterThanOrEqual(3);
    expect(recetas.filter((p) => classifyRecipe(toRecipe(p)) === "legumbre").length).toBeGreaterThanOrEqual(7);
    const dinnersWithVeg = recetas.filter((p) => fitsMeal(toRecipe(p), "cena") && flags(p).vegetables && !flags(p).fastFood);
    expect(dinnersWithVeg.length).toBeGreaterThanOrEqual(10);
  });

  it("los pipos son legumbre", () => {
    expect(classifyRecipe(toRecipe(habituales.find((p) => p.title === "Pipos")!))).toBe("legumbre");
  });
});
