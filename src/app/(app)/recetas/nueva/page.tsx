import type { Metadata } from "next";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { emptyRecipeForm } from "@/lib/domain/recipe-form";

export const metadata: Metadata = { title: "Nueva receta" };

export default function NewRecipePage() {
  return <RecipeForm initial={emptyRecipeForm()} cancelHref="/recetas" />;
}
