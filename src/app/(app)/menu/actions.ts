"use server";

/**
 * Server Actions del menú semanal. Validan todo en servidor.
 */
import { revalidatePath } from "next/cache";
import { isIsoDate, mondayOf } from "@/lib/domain/dates";
import { planParamsSchema, type PlanParams } from "@/lib/domain/menu";
import * as repo from "@/lib/menu/repo";
import { generateWeek, regenerateSlot, setDaySingleCourse } from "@/lib/menu/service";
import { getRecipe } from "@/lib/recipes/repo";

const done = () => revalidatePath("/menu");
const seed = () => Math.floor(Math.random() * 2 ** 31);

function validWeek(weekStart: string): string | null {
  return isIsoDate(weekStart) && mondayOf(weekStart) === weekStart ? weekStart : null;
}

/** Genera la semana, o regenera lo no bloqueado con los parámetros indicados. */
export async function generateMenu(weekStart: string, params: PlanParams): Promise<{ error?: string }> {
  const week = validWeek(weekStart);
  const parsed = planParamsSchema.safeParse(params);
  if (!week || !parsed.success) return { error: "Parámetros del menú no válidos" };
  generateWeek(week, parsed.data, seed());
  done();
  return {};
}

/** Guarda los ajustes sin regenerar. Devuelve si había menú esa semana. */
export async function saveMenuParams(weekStart: string, params: PlanParams): Promise<{ hasPlan: boolean; error?: string }> {
  const week = validWeek(weekStart);
  const parsed = planParamsSchema.safeParse(params);
  if (!week || !parsed.success) return { hasPlan: false, error: "Ajustes no válidos" };
  const res = repo.saveParams(week, parsed.data);
  done();
  return res;
}

export async function regenerateMenuSlot(slotId: string): Promise<void> {
  regenerateSlot(slotId, seed());
  done();
}

/** Comida de ese día: plato único (true) o primero y segundo (false). */
export async function setDayCourses(slotId: string, single: boolean): Promise<void> {
  const found = repo.getSlot(slotId);
  if (!found) return;
  setDaySingleCourse(found.weekStart, found.slot.date, Boolean(single), seed());
  done();
}

export async function toggleSlotLock(slotId: string): Promise<void> {
  const found = repo.getSlot(slotId);
  if (!found) return;
  repo.updateSlot(slotId, { locked: !found.slot.locked });
  done();
}

/** Receta elegida a mano: se bloquea para que no cambie al regenerar. */
export async function setSlotRecipe(slotId: string, recipeId: string): Promise<void> {
  if (!repo.getSlot(slotId) || !getRecipe(recipeId)) return;
  repo.updateSlot(slotId, { recipeId, freeText: null, locked: true });
  done();
}

const FREE_TEXTS = new Set(["Sobras", "Comer fuera", "Improvisar"]);

/** "Sobras", "Comer fuera"… (bloqueado) o null para dejar el hueco vacío. */
export async function setSlotFreeText(slotId: string, text: string | null): Promise<void> {
  if (!repo.getSlot(slotId) || (text !== null && !FREE_TEXTS.has(text))) return;
  repo.updateSlot(slotId, { recipeId: null, freeText: text, locked: text !== null });
  done();
}

export async function deleteMenu(weekStart: string): Promise<void> {
  const week = validWeek(weekStart);
  if (!week) return;
  repo.deletePlan(week);
  done();
}
