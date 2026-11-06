/**
 * Lista de la compra y despensa: acceso a datos + casos de uso. Solo servidor.
 */
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";
import { pantryItems, shoppingItems, shoppingLists } from "@/lib/db/schema";
import type { IsoDate } from "@/lib/domain/dates";
import { parseIngredientLine } from "@/lib/domain/ingredient-parser";
import { buildShoppingList, manualEntry, type NeedLine, type PantryLine } from "@/lib/domain/shopping";
import { getPlan } from "@/lib/menu/repo";
import { getRecipe } from "@/lib/recipes/repo";

export type ShoppingItemRow = typeof shoppingItems.$inferSelect;
export type PantryRow = typeof pantryItems.$inferSelect;

/** Cambios hechos en el móvil (posiblemente sin conexión) que hay que aplicar. */
export type ShoppingOp =
  | { type: "check"; id: string; checked: boolean; at: number }
  | { type: "add"; id: string; text: string; at: number }
  | { type: "delete"; id: string; at: number };

// ---------------------------------------------------------------- despensa

export function listPantry(db: AppDb = getDb()): PantryRow[] {
  return db.select().from(pantryItems).orderBy(asc(pantryItems.name)).all();
}

/** "2 kg de patatas" o "arroz" (sin cantidad = tengo de sobra). */
export function addPantryItem(text: string, db: AppDb = getDb()): void {
  const p = parseIngredientLine(text);
  if (!p.name.trim()) return;
  db.insert(pantryItems).values({ id: randomUUID(), name: p.name.slice(0, 80), quantity: p.quantity, unit: p.unit }).run();
}

export function removePantryItem(id: string, db: AppDb = getDb()): void {
  db.delete(pantryItems).where(eq(pantryItems.id, id)).run();
}

// ---------------------------------------------------------------- menú → necesidades

/** Ingredientes del menú de la semana, escalados a las personas. null si no hay menú. */
export function menuNeedLines(weekStart: IsoDate, db: AppDb = getDb()): { lines: NeedLine[]; recipeStamp: string } | null {
  const plan = getPlan(weekStart, db);
  if (!plan) return null;
  const lines: NeedLine[] = [];
  const stamp: string[] = [];
  for (const slot of plan.slots) {
    if (!slot.recipeId) continue;
    const recipe = getRecipe(slot.recipeId, db);
    if (!recipe) continue;
    stamp.push(`${recipe.id}@${recipe.updatedAt.getTime()}`);
    const factor = plan.params.people / Math.max(1, recipe.servings);
    for (const ing of recipe.ingredients) {
      lines.push({
        name: ing.name,
        quantity: ing.quantity === null ? null : ing.quantity * factor,
        unit: ing.unit,
        source: recipe.title,
      });
    }
  }
  return { lines, recipeStamp: `${plan.params.people}|${stamp.join(",")}` };
}

/** Hash corto y estable (djb2) para detectar cambios. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function pantryStamp(pantry: PantryRow[]): string {
  return pantry.map((p) => `${p.name}:${p.quantity ?? ""}${p.unit ?? ""}`).join("|");
}

/** Huella actual de menú + despensa (null si no hay menú). */
export function currentFingerprint(weekStart: IsoDate, db: AppDb = getDb()): string | null {
  const needs = menuNeedLines(weekStart, db);
  return needs ? hash(`${needs.recipeStamp}#${pantryStamp(listPantry(db))}`) : null;
}

// ---------------------------------------------------------------- lista

export function getList(weekStart: IsoDate, db: AppDb = getDb()) {
  const list = db.select().from(shoppingLists).where(eq(shoppingLists.weekStart, weekStart)).get();
  if (!list) return null;
  const items = db.select().from(shoppingItems).where(eq(shoppingItems.listId, list.id)).orderBy(asc(shoppingItems.position)).all();
  return { list, items };
}

/**
 * (Re)genera la lista desde el menú. Conserva lo añadido a mano y lo que ya
 * estaba marcado (por producto). Devuelve false si no hay menú esa semana.
 */
export function generateList(weekStart: IsoDate, db: AppDb = getDb()): boolean {
  const needs = menuNeedLines(weekStart, db);
  if (!needs) return false;
  const pantry = listPantry(db);
  const pantryLines: PantryLine[] = pantry.map((p) => ({ name: p.name, quantity: p.quantity, unit: p.unit }));
  const { items, covered } = buildShoppingList(needs.lines, pantryLines);
  const fingerprint = hash(`${needs.recipeStamp}#${pantryStamp(pantry)}`);

  db.transaction((tx) => {
    const existing = tx.select().from(shoppingLists).where(eq(shoppingLists.weekStart, weekStart)).get();
    const listId = existing?.id ?? randomUUID();
    let checkedKeys = new Set<string>();

    if (existing) {
      const old = tx.select().from(shoppingItems).where(eq(shoppingItems.listId, listId)).all();
      checkedKeys = new Set(old.filter((i) => i.checked && !i.manual).map((i) => i.key));
      const auto = old.filter((i) => !i.manual).map((i) => i.id);
      if (auto.length) tx.delete(shoppingItems).where(inArray(shoppingItems.id, auto)).run();
      tx.update(shoppingLists).set({ fingerprint, covered }).where(eq(shoppingLists.id, listId)).run();
    } else {
      tx.insert(shoppingLists).values({ id: listId, weekStart, fingerprint, covered }).run();
    }

    if (items.length) {
      tx.insert(shoppingItems)
        .values(
          items.map((it, position) => ({
            id: randomUUID(),
            listId,
            key: it.key,
            name: it.name,
            section: it.section,
            amount: it.amount,
            toTaste: it.toTaste,
            sources: it.sources,
            cost: it.cost,
            pantryNote: it.pantryNote,
            checked: checkedKeys.has(it.key),
            position,
          })),
        )
        .run();
    }
  });
  return true;
}

/**
 * Aplica cambios hechos en el móvil. Idempotente: un "add" con el mismo id no
 * se duplica, y un "check" antiguo no pisa uno más reciente.
 */
export function applyOps(weekStart: IsoDate, ops: ShoppingOp[], db: AppDb = getDb()): void {
  const list = db.select().from(shoppingLists).where(eq(shoppingLists.weekStart, weekStart)).get();
  if (!list) return;
  db.transaction((tx) => {
    for (const op of [...ops].sort((a, b) => a.at - b.at)) {
      const at = new Date(op.at);
      if (op.type === "add") {
        const text = op.text.trim().slice(0, 120);
        if (!text) continue;
        const e = manualEntry(text);
        tx.insert(shoppingItems)
          .values({ id: op.id, listId: list.id, ...e, manual: true, position: 10_000 + Math.floor(op.at / 1000) % 100_000, updatedAt: at })
          .onConflictDoNothing()
          .run();
      } else {
        const item = tx.select().from(shoppingItems).where(eq(shoppingItems.id, op.id)).get();
        if (!item || item.listId !== list.id) continue;
        if (op.type === "delete") tx.delete(shoppingItems).where(eq(shoppingItems.id, op.id)).run();
        else if (item.updatedAt.getTime() <= op.at) {
          tx.update(shoppingItems).set({ checked: op.checked, updatedAt: at }).where(eq(shoppingItems.id, op.id)).run();
        }
      }
    }
  });
}
