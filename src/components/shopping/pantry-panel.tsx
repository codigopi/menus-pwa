"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CircleMinus, Plus } from "lucide-react";
import { addToPantry, removeFromPantry } from "@/app/(app)/compra/actions";
import { formatQuantity } from "@/lib/domain/quantity";
import { unitLabel } from "@/lib/domain/units";
import type { PantryItemView } from "@/lib/shopping/view";

const BASICS = ["sal", "aceite de oliva", "pimienta", "azúcar", "harina", "vinagre", "arroz", "pasta"];

const amountText = (p: PantryItemView) =>
  p.quantity === null ? "de sobra" : [formatQuantity(p.quantity), unitLabel(p.unit, p.quantity) || (p.quantity === 1 ? "ud" : "uds")].join(" ");

/** Despensa: lo que tengas aquí se resta de la lista de la compra. */
export function PantryPanel({ items, online }: { items: PantryItemView[]; online: boolean }) {
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const [optimistic, update] = useOptimistic(items, (state, change: { add?: string; remove?: string }) =>
    change.remove
      ? state.filter((i) => i.id !== change.remove)
      : [...state, { id: `tmp-${change.add}`, name: change.add!, quantity: null, unit: null }],
  );

  const add = (text: string) => {
    if (!text.trim()) return;
    startTransition(async () => {
      update({ add: text.trim() });
      await addToPantry(text.trim());
    });
  };
  const remove = (id: string) =>
    startTransition(async () => {
      update({ remove: id });
      await removeFromPantry(id);
    });

  const have = new Set(optimistic.map((i) => i.name.toLowerCase()));
  const suggestions = BASICS.filter((b) => !have.has(b));

  return (
    <div>
      <p className="mb-3 px-1 text-[14px] leading-snug text-muted">
        Lo que tengas aquí se resta de la lista. Sin cantidad significa «tengo de sobra» (sal, aceite…); con cantidad, solo se resta esa parte.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft("");
        }}
        className="mb-3 flex h-11 items-center gap-2 rounded-xl bg-card px-3"
      >
        <Plus className="size-5 shrink-0 text-accent" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="«arroz», «2 kg de patatas», «6 huevos»…"
          aria-label="Añadir a la despensa"
          disabled={!online}
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
        />
      </form>

      {suggestions.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {suggestions.map((b) => (
            <button
              key={b}
              type="button"
              disabled={!online}
              onClick={() => add(b)}
              className="tap flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-[14px] whitespace-nowrap"
            >
              <Plus className="size-3.5 text-accent" /> {b}
            </button>
          ))}
        </div>
      )}

      {optimistic.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">La despensa está vacía.</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
          {optimistic.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-[16px] first-letter:uppercase">{p.name}</span>
              <span className="shrink-0 text-[15px] text-muted">{amountText(p)}</span>
              <button type="button" disabled={!online} onClick={() => remove(p.id)} aria-label={`Quitar ${p.name}`} className="tap shrink-0">
                <CircleMinus className="size-[22px] fill-danger text-card" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!online && <p className="mt-3 text-center text-[13px] text-muted">La despensa se edita con conexión.</p>}
    </div>
  );
}
