"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isIsoDate, mondayOf } from "@/lib/domain/dates";
import { addPantryItem, applyOps, generateList, removePantryItem } from "@/lib/shopping/service";

const done = () => revalidatePath("/compra");
const validWeek = (w: string) => (isIsoDate(w) && mondayOf(w) === w ? w : null);

export async function generateShoppingList(weekStart: string): Promise<{ error?: string }> {
  const week = validWeek(weekStart);
  if (!week) return { error: "Semana no válida" };
  if (!generateList(week)) return { error: "No hay menú para esta semana" };
  done();
  return {};
}

const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("check"), id: z.string().min(1).max(64), checked: z.boolean(), at: z.number() }),
  z.object({ type: z.literal("add"), id: z.string().min(1).max(64), text: z.string().max(120), at: z.number() }),
  z.object({ type: z.literal("delete"), id: z.string().min(1).max(64), at: z.number() }),
]);

/**
 * Aplica los cambios hechos en el móvil (marcar, añadir, quitar), aunque se
 * hicieran sin conexión. Devuelve la hora del servidor para la sincronización.
 */
export async function syncShopping(weekStart: string, ops: unknown): Promise<{ serverTime: number }> {
  const week = validWeek(weekStart);
  const parsed = z.array(opSchema).max(500).safeParse(ops);
  if (week && parsed.success && parsed.data.length) {
    applyOps(week, parsed.data);
    done();
  }
  return { serverTime: Date.now() };
}

export async function addToPantry(text: string): Promise<void> {
  if (text.trim()) addPantryItem(text.trim().slice(0, 120));
  done();
}

export async function removeFromPantry(id: string): Promise<void> {
  removePantryItem(id);
  done();
}
