"use server";

/**
 * Server Actions de recetas. Validan siempre en servidor con Zod (el cliente
 * también valida, pero no nos fiamos de él).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recipeInputSchema } from "@/lib/domain/recipe";
import * as repo from "@/lib/recipes/repo";
import { deletePhoto, PhotoError, photoExists, savePhoto } from "@/lib/storage/photos";

export type SaveRecipeResult = { ok: false; errors: string[] };

/**
 * Crea o actualiza una receta.
 * FormData esperado:
 *  - data: JSON con los campos de la receta
 *  - id: (opcional) receta a actualizar
 *  - photo: (opcional) nueva imagen
 *  - removePhoto: "1" para quitar la foto actual
 *  - draftPhoto: (opcional) foto ya guardada por el importador
 * Si todo va bien redirige al detalle; si no, devuelve los errores.
 */
export async function saveRecipe(formData: FormData): Promise<SaveRecipeResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, errors: ["Datos del formulario no válidos"] };
  }

  const parsed = recipeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  }

  // Foto: undefined = no tocar, null = quitar, string = nueva.
  let photo: string | null | undefined;
  const file = formData.get("photo");
  const draftPhoto = formData.get("draftPhoto");
  try {
    if (file instanceof File && file.size > 0) photo = await savePhoto(file);
    else if (formData.get("removePhoto") === "1") photo = null;
    // Foto ya descargada por el importador: solo la aceptamos si existe y el nombre es nuestro.
    else if (typeof draftPhoto === "string" && (await photoExists(draftPhoto))) photo = draftPhoto;
  } catch (err) {
    if (err instanceof PhotoError) return { ok: false, errors: [err.message] };
    throw err;
  }

  const id = formData.get("id");
  let recipeId: string;
  if (typeof id === "string" && id) {
    const res = repo.updateRecipe(id, parsed.data, photo);
    if (!res) {
      await deletePhoto(photo);
      return { ok: false, errors: ["La receta ya no existe"] };
    }
    await deletePhoto(res.previousPhoto);
    recipeId = id;
  } else {
    recipeId = repo.createRecipe(parsed.data, photo ?? null);
  }

  revalidatePath("/recetas", "layout");
  redirect(`/recetas/${recipeId}`);
}

export async function deleteRecipeAction(id: string): Promise<void> {
  const res = repo.deleteRecipe(id);
  if (res) await deletePhoto(res.photo);
  revalidatePath("/recetas", "layout");
  redirect("/recetas");
}

export async function rateRecipe(id: string, rating: number | null): Promise<void> {
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return;
  repo.setRating(id, rating);
  revalidatePath("/recetas", "layout");
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  repo.setFavorite(id, Boolean(isFavorite));
  revalidatePath("/recetas", "layout");
}
