"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, CircleMinus, CloudOff, Plus, RefreshCw, Share, ShoppingBasket, Sparkles } from "lucide-react";
import { generateShoppingList } from "@/app/(app)/compra/actions";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { WeekNav } from "@/components/ui/week-nav";
import { SECTION_LABELS, SECTIONS } from "@/lib/domain/catalog";
import { shoppingListText } from "@/lib/domain/shopping";
import { useShoppingSync } from "@/lib/offline/use-shopping-sync";
import type { ShoppingItemView, ShoppingView } from "@/lib/shopping/view";
import { CachePage } from "@/components/pwa/cache-page";
import { PantryPanel } from "./pantry-panel";

type Tab = "lista" | "despensa";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pantalla de la compra: lista (offline) y despensa. */
export function ShoppingScreen({ view }: { view: ShoppingView }) {
  const [tab, setTab] = useState<Tab>("lista");
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sync = useShoppingSync(view);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function share() {
    if (!sync.items) return;
    const text = shoppingListText(`Compra ${view.rangeLabel}`, sync.items, SECTION_LABELS);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setToast("Lista copiada");
      }
    } catch {
      // compartir cancelado
    }
  }

  return (
    <>
      <PageHeader
        title="Compra"
        actions={
          tab === "lista" && sync.items ? (
            <>
              <button type="button" onClick={share} aria-label="Compartir lista" className="tap grid size-9 place-items-center text-accent">
                <Share className="size-[22px]" />
              </button>
              <button type="button" onClick={() => setEditing(!editing)} className="tap px-1 text-[17px] text-accent">
                {editing ? "Listo" : "Editar"}
              </button>
            </>
          ) : undefined
        }
      />

      <CachePage url="/compra" />
      <WeekNav basePath="/compra" rangeLabel={view.rangeLabel} prevWeek={view.prevWeek} nextWeek={view.nextWeek} isCurrentWeek={view.isCurrentWeek} />

      <div className="mb-4">
        <Segmented
          label="Sección"
          value={tab}
          onChange={setTab}
          options={[
            { value: "lista", label: "Lista" },
            { value: "despensa", label: `Despensa${view.pantry.length ? ` · ${view.pantry.length}` : ""}` },
          ]}
        />
      </div>

      {(!sync.online || sync.pendingCount > 0) && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-[13px] text-muted" role="status">
          <CloudOff className="size-4 shrink-0" />
          {sync.online
            ? `Guardando ${sync.pendingCount} ${sync.pendingCount === 1 ? "cambio" : "cambios"}…`
            : `Sin conexión${sync.pendingCount ? ` · ${sync.pendingCount} ${sync.pendingCount === 1 ? "cambio pendiente" : "cambios pendientes"}` : ""}. Se guardará al volver la red.`}
        </p>
      )}

      {tab === "despensa" ? (
        <PantryPanel items={view.pantry} online={sync.online} />
      ) : (
        <ListTab view={view} sync={sync} editing={editing} />
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-50 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-canvas shadow-lg">{toast}</span>
        </div>
      )}
    </>
  );
}

function ListTab({ view, sync, editing }: { view: ShoppingView; sync: ReturnType<typeof useShoppingSync>; editing: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showChecked, setShowChecked] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateShoppingList(view.weekStart);
      if (res.error) setError(res.error);
    });
  }

  if (!sync.items) {
    return (
      <section className="flex flex-col items-center rounded-2xl bg-card px-6 py-10 text-center">
        <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
          <ShoppingBasket className="size-8" />
        </div>
        {view.hasMenu ? (
          <>
            <h2 className="text-[20px] font-semibold">Lista de esta semana</h2>
            <p className="mt-1.5 mb-6 max-w-xs text-[15px] text-muted">
              La preparo con los ingredientes del menú, agrupados por secciones y restando lo que tengas en la despensa.
            </p>
            <Button size="lg" className="max-w-xs" disabled={pending || !sync.online} onClick={generate}>
              <Sparkles className="size-5" /> {pending ? "Preparando…" : "Generar lista desde el menú"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-semibold">Aún no hay menú</h2>
            <p className="mt-1.5 mb-6 max-w-xs text-[15px] text-muted">Genera el menú de esta semana y te preparo la lista de la compra.</p>
            <LinkButton href={`/menu?semana=${view.weekStart}`}>Ir al menú</LinkButton>
          </>
        )}
        {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
      </section>
    );
  }

  const items = sync.items;
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const costItems = items.filter((i) => i.cost !== null);
  const total = costItems.reduce((s, i) => s + (i.cost ?? 0), 0);

  return (
    <>
      {view.list?.stale && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 pl-4" role="status">
          <p className="min-w-0 flex-1 text-[14px] leading-snug">El menú o la despensa han cambiado.</p>
          <Button disabled={pending || !sync.online} onClick={generate} className="shrink-0">
            <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Actualizar
          </Button>
        </div>
      )}

      <p className="mb-3 px-1 text-[13px] text-muted">
        {done.length} de {items.length} en el carro
        {costItems.length * 2 >= items.length && costItems.length > 0 && (
          <> · <span className="text-ink">≈ {Math.round(total)} €</span> (orientativo)</>
        )}
      </p>

      {/* Añadir a mano */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) sync.add(draft.trim());
          setDraft("");
        }}
        className="mb-5 flex h-11 items-center gap-2 rounded-xl bg-card px-3"
      >
        <Plus className="size-5 shrink-0 text-accent" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Añadir algo más…"
          aria-label="Añadir a la lista"
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
        />
      </form>

      {todo.length === 0 && (
        <p className="mb-6 rounded-2xl bg-accent-soft px-4 py-5 text-center text-[16px] font-medium text-accent">¡Todo en el carro! 🎉</p>
      )}

      {SECTIONS.map((section) => {
        const inSection = todo.filter((i) => i.section === section);
        if (inSection.length === 0) return null;
        return (
          <section key={section} className="mb-5">
            <h2 className="mb-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">{SECTION_LABELS[section]}</h2>
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {inSection.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} editing={editing} onToggle={() => sync.toggle(item.id, true)} onRemove={() => sync.remove(item.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="mb-5">
          <button
            type="button"
            onClick={() => setShowChecked(!showChecked)}
            className="mb-1.5 flex w-full items-center gap-1 px-1 text-[13px] font-medium tracking-wide text-muted uppercase"
          >
            En el carro · {done.length}
            <ChevronDown className={cn("size-4 transition-transform", showChecked && "rotate-180")} />
          </button>
          {showChecked && (
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {done.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} editing={editing} onToggle={() => sync.toggle(item.id, false)} onRemove={() => sync.remove(item.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view.list && view.list.covered.length > 0 && (
        <details className="group mb-5 rounded-2xl bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[15px] [&::-webkit-details-marker]:hidden">
            <span className="flex-1">Ya en la despensa · {view.list.covered.length}</span>
            <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="border-t border-hairline px-4 py-2 text-[15px] text-muted">
            {view.list.covered.map((c) => (
              <li key={c.key} className="flex justify-between py-1">
                <span>{capitalize(c.name)}</span>
                <span>{c.amount}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {view.list && !view.list.stale && (
        <Button variant="plain" className="w-full" disabled={pending || !sync.online} onClick={generate}>
          <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Volver a generar desde el menú
        </Button>
      )}
    </>
  );
}

function ItemRow({ item, editing, onToggle, onRemove }: { item: ShoppingItemView; editing: boolean; onToggle: () => void; onRemove: () => void }) {
  const detail = [item.sources.join(" · "), item.pantryNote].filter(Boolean).join(" — ");
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {editing && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${item.name}`} className="tap shrink-0">
          <CircleMinus className="size-[22px] fill-danger text-card" />
        </button>
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
            item.checked ? "border-accent bg-accent text-accent-ink" : "border-fill-strong",
          )}
        >
          {item.checked && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[16px] leading-snug", item.checked && "text-muted line-through")}>{capitalize(item.name)}</span>
          {detail && !item.checked && <span className="block truncate text-[12px] text-muted">{detail}</span>}
        </span>
        <span className={cn("shrink-0 text-[15px] tabular-nums", item.checked ? "text-muted/60" : "text-muted")}>
          {item.amount || (item.toTaste ? "un poco" : "")}
        </span>
      </button>
    </div>
  );
}
