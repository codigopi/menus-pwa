"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { ChefHat, CircleMinus } from "lucide-react";
import { removeCookLog } from "@/app/(app)/historico/actions";
import { CategoryDot } from "@/components/menu/category";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { daysBetween } from "@/lib/domain/dates";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/domain/menu";
import type { HistoryView } from "@/lib/history/view";

const monthLabel = (iso: string) => {
  const s = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function agoLabel(days: number): string {
  if (days < 60) return `hace ${days} días`;
  const months = Math.round(days / 30);
  return `hace ${months} meses`;
}

export function HistoryScreen({ view }: { view: HistoryView }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const [logs, removeLocal] = useOptimistic(view.logs, (state, id: string) => state.filter((l) => l.id !== id));
  const { stats } = view;

  const remove = (id: string) =>
    startTransition(async () => {
      removeLocal(id);
      await removeCookLog(id);
    });

  if (view.logs.length === 0) {
    return (
      <>
        <PageHeader title="Histórico" back={{ href: "/mas", label: "Más" }} />
        <EmptyState icon={<ChefHat className="size-8" />} title="Aún no hay nada apuntado" action={<LinkButton href="/menu">Ir al menú</LinkButton>}>
          Cuando cocines un plato, márcalo con «Lo he cocinado» desde el menú o desde la receta. Aquí verás qué hacéis más, lo mejor valorado y tus notas.
        </EmptyState>
      </>
    );
  }

  // Agrupar por mes
  const months = new Map<string, typeof logs>();
  for (const l of logs) {
    const key = l.cookedOn.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), l]);
  }

  return (
    <>
      <PageHeader
        title="Histórico"
        back={{ href: "/mas", label: "Más" }}
        actions={
          <button type="button" onClick={() => setEditing(!editing)} className="tap px-1 text-[17px] text-accent">
            {editing ? "Listo" : "Editar"}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat value={stats.thisMonth} label="este mes" />
        <Stat value={stats.last30} label="últimos 30 días" />
      </div>

      {stats.last30 > 0 && (
        <ul className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4" aria-label="Tipos de plato en 30 días">
          {CATEGORIES.filter((c) => stats.categories[c]).map((c) => (
            <li key={c} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-medium">
              <CategoryDot category={c} /> {stats.categories[c]} {CATEGORY_LABELS[c].toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      <Ranking title="Lo que más cocináis">
        {stats.topCooked.map((t, i) => (
          <RankRow key={t.recipeId ?? t.title} index={i} href={t.recipeId ? `/recetas/${t.recipeId}` : undefined} title={t.title} detail={`${t.count} ${t.count === 1 ? "vez" : "veces"}`} />
        ))}
      </Ranking>

      {stats.bestRated.length > 0 && (
        <Ranking title="Los mejor valorados">
          {stats.bestRated.map((b, i) => (
            <RankRow key={b.recipeId} index={i} href={`/recetas/${b.recipeId}`} title={b.title} detail={<StarRating value={Math.round(b.avg)} size="sm" />} />
          ))}
        </Ranking>
      )}

      {stats.missYou.length > 0 && (
        <Ranking title="Hace tiempo que no los hacéis">
          {stats.missYou.map((m) => (
            <RankRow key={m.recipeId} href={`/recetas/${m.recipeId}`} title={m.title} detail={agoLabel(m.daysAgo)} />
          ))}
        </Ranking>
      )}

      {stats.neverCooked.length > 0 && (
        <Ranking title={`Aún sin estrenar · ${stats.neverCooked.length}`}>
          {stats.neverCooked.slice(0, 5).map((n) => (
            <RankRow key={n.recipeId} href={`/recetas/${n.recipeId}`} title={n.title} />
          ))}
        </Ranking>
      )}

      <h2 className="mt-8 mb-3 px-1 text-[20px] font-bold">Todo lo cocinado</h2>
      {[...months.entries()].map(([month, items]) => (
        <section key={month} className="mb-5">
          <h3 className="mb-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">{monthLabel(`${month}-01`)}</h3>
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
            {items.map((l) => {
              const photo = l.recipeId ? view.photos[l.recipeId] ?? null : null;
              const body = (
                <>
                  <RecipePhoto photo={photo} title={l.recipeTitle} className="size-11 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[16px]">{l.recipeTitle}</span>
                      {l.rating && <StarRating value={l.rating} size="sm" />}
                    </span>
                    <span className="block text-[13px] text-muted">
                      {dayLabel(l.cookedOn)}
                      {daysBetween(l.cookedOn, view.today) === 0 && " · hoy"}
                    </span>
                    {l.notes && <span className="mt-0.5 block text-[14px] leading-snug text-ink/80">«{l.notes}»</span>}
                  </span>
                </>
              );
              return (
                <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                  {editing && (
                    <button type="button" onClick={() => remove(l.id)} aria-label={`Borrar ${l.recipeTitle} del ${l.cookedOn}`} className="tap mt-2.5 shrink-0">
                      <CircleMinus className="size-[22px] fill-danger text-card" />
                    </button>
                  )}
                  {l.recipeId && !editing ? (
                    <Link href={`/recetas/${l.recipeId}`} className="flex min-w-0 flex-1 items-start gap-3">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3">
      <p className="font-rounded text-[32px] leading-none font-bold text-accent">{value}</p>
      <p className="mt-1 text-[13px] text-muted">{value === 1 ? "plato" : "platos"} {label}</p>
    </div>
  );
}

function Ranking({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">{title}</h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">{children}</ul>
    </section>
  );
}

function RankRow({ index, href, title, detail }: { index?: number; href?: string; title: string; detail?: ReactNode }) {
  const content = (
    <>
      {index !== undefined && <span className="w-5 shrink-0 text-center text-[15px] font-semibold text-muted">{index + 1}</span>}
      <span className="min-w-0 flex-1 truncate text-[16px]">{title}</span>
      {detail && <span className="shrink-0 text-[14px] text-muted">{detail}</span>}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 active:bg-fill">
          {content}
        </Link>
      ) : (
        <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">{content}</div>
      )}
    </li>
  );
}
