import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { recipeToForm } from "@/lib/domain/recipe-form";
import { fetchRecipe } from "@/lib/recipes/queries";

export const metadata: Metadata = { title: "Editar receta" };

export default function EditRecipePage({ params }: PageProps<"/recetas/[id]/editar">) {
  return (
    <Suspense fallback={<div className="h-11" />}>
      <EditForm params={params} />
    </Suspense>
  );
}

async function EditForm({ params }: { params: PageProps<"/recetas/[id]/editar">["params"] }) {
  const { id } = await params;
  const recipe = await fetchRecipe(id);
  if (!recipe) notFound();
  return (
    <RecipeForm
      initial={recipeToForm(recipe)}
      recipeId={recipe.id}
      initialPhoto={recipe.photo}
      cancelHref={`/recetas/${recipe.id}`}
    />
  );
}
