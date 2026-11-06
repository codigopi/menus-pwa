/**
 * Datos para la pantalla de la compra (Server Components).
 */
import { connection } from "next/server";
import { addDays, isIsoDate, mondayOf, todayIso, weekRangeLabel, type IsoDate } from "@/lib/domain/dates";
import type { Section } from "@/lib/domain/catalog";
import { getPlan } from "@/lib/menu/repo";
import { currentFingerprint, getList, listPantry } from "./service";

export interface ShoppingItemView {
  id: string;
  key: string;
  name: string;
  section: Section;
  amount: string;
  toTaste: boolean;
  sources: string[];
  cost: number | null;
  pantryNote: string | null;
  checked: boolean;
  manual: boolean;
}

export interface PantryItemView {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface ShoppingView {
  weekStart: IsoDate;
  rangeLabel: string;
  prevWeek: IsoDate;
  nextWeek: IsoDate;
  isCurrentWeek: boolean;
  hasMenu: boolean;
  list: {
    items: ShoppingItemView[];
    covered: { key: string; name: string; amount: string }[];
    /** El menú o la despensa cambiaron desde que se generó. */
    stale: boolean;
  } | null;
  pantry: PantryItemView[];
  /** Hora del servidor al generar estos datos (para la sincronización offline). */
  renderedAt: number;
}

export async function loadShoppingView(weekParam: string | undefined): Promise<ShoppingView> {
  await connection();
  const today = todayIso();
  const weekStart = mondayOf(isIsoDate(weekParam) ? weekParam : today);
  const data = getList(weekStart);
  const hasMenu = getPlan(weekStart) !== null;

  return {
    weekStart,
    rangeLabel: weekRangeLabel(weekStart),
    prevWeek: addDays(weekStart, -7),
    nextWeek: addDays(weekStart, 7),
    isCurrentWeek: weekStart === mondayOf(today),
    hasMenu,
    list: data
      ? {
          items: data.items.map((i) => ({
            id: i.id,
            key: i.key,
            name: i.name,
            section: i.section,
            amount: i.amount,
            toTaste: i.toTaste,
            sources: i.sources,
            cost: i.cost,
            pantryNote: i.pantryNote,
            checked: i.checked,
            manual: i.manual,
          })),
          covered: data.list.covered,
          stale: hasMenu && currentFingerprint(weekStart) !== data.list.fingerprint,
        }
      : null,
    pantry: listPantry().map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, unit: p.unit })),
    renderedAt: Date.now(),
  };
}
