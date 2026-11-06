import { MEAL_LABELS, type Course, type Meal } from "@/lib/domain/menu";

/** Etiqueta de un hueco: "Primero", "Segundo", "Comida" (plato único) o "Cena". */
export function slotLabel(slot: { meal: Meal; course: Course }): string {
  if (slot.meal === "comida" && slot.course === "primero") return "Primero";
  if (slot.meal === "comida" && slot.course === "segundo") return "Segundo";
  return MEAL_LABELS[slot.meal];
}
