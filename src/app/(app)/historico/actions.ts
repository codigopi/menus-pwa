"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isIsoDate } from "@/lib/domain/dates";
import { MEALS } from "@/lib/domain/menu";
import { addCookLog, deleteCookLog } from "@/lib/history/repo";

const logSchema = z.object({
  recipeId: z.string().min(1).max(64),
  cookedOn: z.string().refine((d) => isIsoDate(d), "Fecha no válida"),
  meal: z.enum(MEALS).nullable().optional(),
  slotId: z.string().max(64).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** El histórico afecta a recetas, menú, sugerencias…: se refresca todo. */
const done = () => revalidatePath("/", "layout");

export async function logCooked(input: z.input<typeof logSchema>): Promise<{ error?: string }> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  if (!addCookLog(parsed.data)) return { error: "La receta ya no existe" };
  done();
  return {};
}

export async function removeCookLog(id: string): Promise<void> {
  deleteCookLog(id);
  done();
}
