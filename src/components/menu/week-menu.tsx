"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, Check, Lock, Plus, RefreshCw, SlidersHorizontal, Soup, Trash2, Utensils, X } from "lucide-react";
import {
  deleteMenu,
  generateMenu,
  regenerateMenuSlot,
  saveMenuParams,
  setSlotFreeText,
  setSlotRecipe,
  toggleSlotLock,
} from "@/app/(app)/menu/actions";
import { CookSheet } from "@/components/history/cook-sheet";
import { CachePage } from "@/components/pwa/cache-page";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { WeekNav } from "@/components/ui/week-nav";
import { CATEGORIES, CATEGORY_LABELS, MEAL_LABELS, type PlanParams } from "@/lib/domain/menu";
import { formatMinutes } from "@/lib/domain/recipe";
import type { MenuView, SlotView } from "@/lib/menu/view";
import { CategoryDot } from "./category";
import { ParamsSheet, paramsSummary } from "./params-sheet";
import { SlotSheet, type SlotActions } from "./slot-sheet";

/** Pantalla del menú semanal. */
export function WeekMenu({ view }: { view: MenuView }) {
  const [pending, startTransition] = useTransition();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [openSlot, setOpenSlot] = useState<SlotView | null>(null);
  const [cookSlot, setCookSlot] = useState<SlotView | null>(null);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Ajustes guardados que aún no se han aplicado al menú de esta semana. */
  const [unapplied, setUnapplied] = useState(false);

  const plan = view.plan;

  function generate(params: PlanParams) {
    setError(null);
    startTransition(async () => {
      const res = await generateMenu(view.weekStart, params);
      if (res.error) setError(res.error);
      else {
        setParamsOpen(false);
        setUnapplied(false);
      }
    });
  }

  function saveParams(params: PlanParams) {
    startTransition(async () => {
      const res = await saveMenuParams(view.weekStart, params);
      if (res.error) setError(res.error);
      else if (res.hasPlan) setUnapplied(true);
    });
  }

  /** Ejecuta una acción sobre un hueco mostrando su estado de carga. */
  const onSlot =
    <A extends unknown[]>(fn: (slotId: string, ...args: A) => Promise<void>) =>
    (slotId: string, ...args: A) => {
      setBusySlot(slotId);
      startTransition(async () => {
        await fn(slotId, ...args);
        setBusySlot(null);
      });
    };

  const actions: SlotActions = {
    regenerate: onSlot(regenerateMenuSlot),
    toggleLock: onSlot(toggleSlotLock),
    setRecipe: onSlot(setSlotRecipe),
    setFreeText: onSlot(setSlotFreeText),
    cook: (slot) => setCookSlot(slot),
  };

  const openDay = plan?.days.find((d) => d.slots.some((s) => s.id === openSlot?.id));

  return (
    <>
      <PageHeader
        title="Menú"
        actions={
          <button type="button" onClick={() => setParamsOpen(true)} aria-label="Ajustes del menú" className="tap grid size-9 place-items-center text-accent">
            <SlidersHorizontal className="size-6" />
          </button>
        }
      />

      <CachePage url="/menu" />
      <WeekNav
        basePath="/menu"
        rangeLabel={view.rangeLabel}
        prevWeek={view.prevWeek}
        nextWeek={view.nextWeek}
        isCurrentWeek={view.isCurrentWeek}
      />

      {error && <p role="alert" className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-[15px] text-danger">{error}</p>}

      {!plan ? (
        <section className="flex flex-col items-center rounded-2xl bg-card px-6 py-10 text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
            <CalendarDays className="size-8" />
          </div>
          <h2 className="text-[20px] font-semibold">Sin menú para esta semana</h2>
          {view.library.length === 0 ? (
            <>
              <p className="mt-1.5 mb-6 max-w-xs text-[15px] text-muted">Para generar el menú necesito recetas. Importa o escribe algunas primero.</p>
              <LinkButton href="/importar">Importar recetas</LinkButton>
            </>
          ) : (
            <>
              <p className="mt-1.5 mb-6 max-w-xs text-[15px] text-muted">{paramsSummary(view.defaultParams)}</p>
              <div className="flex w-full max-w-xs flex-col gap-2">
                <Button size="lg" disabled={pending} onClick={() => generate(view.defaultParams)}>
                  <RefreshCw className={cn("size-5", pending && "animate-spin")} /> {pending ? "Generando…" : "Generar menú"}
                </Button>
                <Button variant="plain" onClick={() => setParamsOpen(true)}>
                  Ajustar antes de generar
                </Button>
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <p className="mb-2 px-1 text-[13px] text-muted">
            {paramsSummary(plan.params)}
            {/* Solo si se puede estimar al menos la mitad de los platos */}
            {plan.cost.priced > 0 && plan.cost.priced * 2 >= plan.cost.dishes && (
              <> · <span className="text-ink">≈ {Math.round(plan.cost.total)} € la semana</span> (orientativo)</>
            )}
          </p>

          {unapplied && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 pl-4" role="status">
              <p className="min-w-0 flex-1 text-[14px] leading-snug">Ajustes guardados. ¿Aplicarlos al menú de esta semana?</p>
              <Button size="md" disabled={pending} onClick={() => generate(plan.params)} className="shrink-0">
                Regenerar
              </Button>
              <button type="button" aria-label="Ahora no" onClick={() => setUnapplied(false)} className="tap shrink-0 text-muted">
                <X className="size-5" />
              </button>
            </div>
          )}

          {/* Equilibrio de la semana */}
          <ul className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4" aria-label="Equilibrio de la semana">
            {CATEGORIES.filter((c) => plan.stats[c]).map((c) => (
              <li key={c} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-medium">
                <CategoryDot category={c} /> {plan.stats[c]} {CATEGORY_LABELS[c].toLowerCase()}
              </li>
            ))}
          </ul>

          {plan.warnings.length > 0 && (
            <div className="mb-4 rounded-2xl bg-terra-soft p-4 text-[14px] leading-snug">
              {plan.warnings.map((w) => (
                <p key={w} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-terra" /> {w}
                </p>
              ))}
            </div>
          )}

          {plan.days.map((day) => (
            <section key={day.date} className="mb-5">
              <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[15px] font-semibold">
                {day.label}
                {day.isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">Hoy</span>}
              </h2>
              <ul className={cn("divide-y divide-hairline overflow-hidden rounded-2xl bg-card", day.isToday && "ring-2 ring-accent/30")}>
                {day.slots.map((slot) => (
                  <li key={slot.id}>
                    <SlotRow slot={slot} busy={busySlot === slot.id} onOpen={() => setOpenSlot(slot)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="mt-6 flex flex-col gap-2">
            <Button variant="secondary" size="lg" disabled={pending} onClick={() => generate(plan.params)}>
              <RefreshCw className={cn("size-5", pending && !busySlot && "animate-spin")} /> Regenerar lo no bloqueado
            </Button>
            <Button variant="plain" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Borrar el menú de esta semana
            </Button>
          </div>
        </>
      )}

      <SlotSheet
        slot={openSlot}
        dayLabel={openDay?.label ?? ""}
        library={view.library}
        actions={actions}
        onClose={() => setOpenSlot(null)}
      />

      {cookSlot?.recipe && (
        <CookSheet
          recipe={cookSlot.recipe}
          defaultDate={cookSlot.date}
          meal={cookSlot.meal}
          slotId={cookSlot.id}
          onClose={() => setCookSlot(null)}
        />
      )}

      {paramsOpen && (
        <ParamsSheet
          open
          onClose={() => setParamsOpen(false)}
          initial={plan?.params ?? view.defaultParams}
          hasPlan={!!plan}
          pending={pending}
          onSubmit={generate}
          onSave={saveParams}
        />
      )}

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <div className="mb-2 overflow-hidden rounded-2xl bg-card/95 text-center backdrop-blur-xl">
          <p className="px-6 pt-4 pb-3 text-[13px] text-muted">Se borrará el menú de la semana del {view.rangeLabel}. Las recetas no se tocan.</p>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              startTransition(() => deleteMenu(view.weekStart));
            }}
            className="h-14 w-full border-t border-hairline text-[20px] text-danger"
          >
            Borrar menú
          </button>
        </div>
        <button type="button" onClick={() => setConfirmDelete(false)} className="h-14 w-full rounded-2xl bg-card text-[20px] font-semibold text-accent">
          Cancelar
        </button>
      </Sheet>
    </>
  );
}

function SlotRow({ slot, busy, onOpen }: { slot: SlotView; busy: boolean; onOpen: () => void }) {
  const r = slot.recipe;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-opacity active:bg-fill", busy && "animate-pulse opacity-50")}
    >
      <span className="w-14 shrink-0 text-[13px] font-medium text-muted">{MEAL_LABELS[slot.meal]}</span>
      {r ? (
        <>
          <RecipePhoto photo={r.photo} title={r.title} className="size-11 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px]">{r.title}</span>
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <CategoryDot category={r.category} />
              {CATEGORY_LABELS[r.category]}
              {r.minutes !== null && ` · ${formatMinutes(r.minutes)}`}
            </span>
          </span>
        </>
      ) : slot.freeText ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[16px] text-muted">
          {slot.freeText === "Sobras" ? <Soup className="size-5" /> : <Utensils className="size-5" />}
          {slot.freeText}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[16px] text-muted/80">
          <Plus className="size-5" /> Sin plato
        </span>
      )}
      {slot.cooked && (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-label="Cocinado">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
      {slot.locked && <Lock className="size-4 shrink-0 text-muted" aria-label="Bloqueado" />}
    </button>
  );
}
