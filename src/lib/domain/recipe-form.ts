/**
 * Conversión entre el estado del formulario (strings, listas planas con
 * cabeceras de sección) y el modelo validado de receta.
 *
 * En el formulario los ingredientes son una lista plana donde pueden aparecer
 * "secciones" ("Para la salsa"); todos los ingredientes que siguen a una
 * sección pertenecen a ella. En el modelo, cada ingrediente lleva su `group`.
 */
import { parseQuantity, quantityToInput } from "./quantity";
import type { Recipe, RecipeInput, SourceType } from "./recipe";
import type { UnitKey } from "./units";

export type IngredientEntry =
  | { key: string; kind: "item"; quantity: string; unit: UnitKey | ""; name: string; note: string }
  | { key: string; kind: "section"; label: string };

export interface StepEntry {
  key: string;
  text: string;
}

export interface RecipeFormState {
  title: string;
  description: string;
  servings: number;
  prepMinutes: string;
  cookMinutes: string;
  tags: string[];
  ingredients: IngredientEntry[];
  steps: StepEntry[];
  sourceUrl: string;
  sourceType: SourceType;
  rating: number | null;
  isFavorite: boolean;
}

let keyCounter = 0;
// Prefijo distinto en servidor y navegador: las claves creadas en el render del
// servidor nunca chocan con las que se crean luego al editar en el cliente.
// (No usamos Date.now()/Math.random(): romperían el prerender de Cache Components.)
const KEY_PREFIX = typeof window === "undefined" ? "s" : "c";
/** Clave estable para listas de React (no se persiste). */
export const newKey = () => `${KEY_PREFIX}${(keyCounter++).toString(36)}`;

export const emptyIngredient = (): IngredientEntry => ({
  key: newKey(),
  kind: "item",
  quantity: "",
  unit: "",
  name: "",
  note: "",
});

export const emptyStep = (): StepEntry => ({ key: newKey(), text: "" });

export function emptyRecipeForm(): RecipeFormState {
  return {
    title: "",
    description: "",
    servings: 2,
    prepMinutes: "",
    cookMinutes: "",
    tags: [],
    ingredients: [emptyIngredient()],
    steps: [emptyStep()],
    sourceUrl: "",
    sourceType: "manual",
    rating: null,
    isFavorite: false,
  };
}

/** Receta guardada (o borrador del importador) → estado editable. */
export function recipeToForm(r: RecipeInput | Recipe): RecipeFormState {
  const ingredients: IngredientEntry[] = [];
  let currentGroup: string | null = null;
  for (const ing of r.ingredients) {
    // Nueva sección cuando cambia el grupo. Una sección con etiqueta vacía
    // "cierra" el grupo anterior (ingredientes sin grupo tras una sección).
    if (ing.group !== currentGroup) {
      ingredients.push({ key: newKey(), kind: "section", label: ing.group ?? "" });
    }
    currentGroup = ing.group;
    ingredients.push({
      key: newKey(),
      kind: "item",
      quantity: quantityToInput(ing.quantity),
      unit: ing.unit ?? "",
      name: ing.name,
      note: ing.note ?? "",
    });
  }

  return {
    title: r.title,
    description: r.description ?? "",
    servings: r.servings,
    prepMinutes: r.prepMinutes?.toString() ?? "",
    cookMinutes: r.cookMinutes?.toString() ?? "",
    tags: r.tags,
    ingredients: ingredients.length ? ingredients : [emptyIngredient()],
    steps: r.steps.length ? r.steps.map((s) => ({ key: newKey(), text: s.text })) : [emptyStep()],
    sourceUrl: r.sourceUrl ?? "",
    sourceType: r.sourceType,
    rating: r.rating,
    isFavorite: r.isFavorite,
  };
}

export type FormConversion =
  | { ok: true; data: unknown }
  | { ok: false; errors: string[] };

const parseMinutes = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
};

/**
 * Estado del formulario → objeto listo para validar con `recipeInputSchema`.
 * Descarta filas vacías y detecta cantidades ilegibles con un mensaje claro.
 * (La validación de tipos/rangos la hace después el esquema Zod en servidor.)
 */
export function formToRecipeInput(form: RecipeFormState): FormConversion {
  const errors: string[] = [];
  const ingredients: unknown[] = [];
  let group: string | null = null;

  for (const entry of form.ingredients) {
    if (entry.kind === "section") {
      group = entry.label.trim() || null;
      continue;
    }
    const name = entry.name.trim();
    if (!name && !entry.quantity.trim()) continue; // fila vacía
    const quantity = parseQuantity(entry.quantity);
    if (Number.isNaN(quantity)) {
      errors.push(`No entiendo la cantidad "${entry.quantity}" de ${name || "un ingrediente"}`);
      continue;
    }
    if (!name) {
      errors.push(`Hay una cantidad (${entry.quantity}) sin ingrediente`);
      continue;
    }
    ingredients.push({
      quantity,
      unit: entry.unit || null,
      name,
      note: entry.note,
      group,
    });
  }

  const prepMinutes = parseMinutes(form.prepMinutes);
  const cookMinutes = parseMinutes(form.cookMinutes);
  if (Number.isNaN(prepMinutes) || Number.isNaN(cookMinutes)) {
    errors.push("Los tiempos deben ser números de minutos");
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title: form.title,
      description: form.description,
      servings: form.servings,
      prepMinutes,
      cookMinutes,
      tags: form.tags,
      ingredients,
      steps: form.steps.map((s) => ({ text: s.text.trim() })).filter((s) => s.text),
      sourceUrl: form.sourceUrl.trim(),
      sourceType: form.sourceType,
      rating: form.rating,
      isFavorite: form.isFavorite,
    },
  };
}
