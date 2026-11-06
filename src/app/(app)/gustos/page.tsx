import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Clock, Heart, ThumbsDown } from "lucide-react";
import { CategoryDot } from "@/components/menu/category";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { IdeaGenerator } from "@/components/taste/idea-generator";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/components/ui/cn";
import { loadTasteView } from "@/lib/taste/view";

export const metadata: Metadata = { title: "Tus gustos" };

export default function TastePage() {
  return (
    <>
      <PageHeader title="Tus gustos" back={{ href: "/mas", label: "Más" }} subtitle="Aprendo de lo que valoráis y cocináis" />
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-2xl bg-card" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const v = await loadTasteView();
  const learning = v.signals < 3;

  return (
    <>
      {learning ? (
        <p className="mb-6 rounded-2xl bg-accent-soft p-4 text-[15px] leading-snug">
          Todavía estoy aprendiendo ({v.signals} {v.signals === 1 ? "receta valorada" : "recetas valoradas"}). Valora recetas, marca favoritas y
          apunta lo que cocináis con «Lo he cocinado»: con eso ajusto el menú y las sugerencias a vuestro gusto.
        </p>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Tipos de plato</h2>
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
              {v.categories.map((c) => (
                <li key={c.category} className="flex items-center gap-3 px-4 py-2.5">
                  <CategoryDot category={c.category} className="size-2.5" />
                  <span className="w-28 shrink-0 text-[15px]">{c.label}</span>
                  {/* Barra centrada: izquierda = gusta menos, derecha = gusta más */}
                  <span className="relative h-2 flex-1 rounded-full bg-fill" aria-label={`Afinidad ${Math.round(c.score * 100)}`}>
                    <span className="absolute top-0 left-1/2 h-2 w-px bg-hairline" />
                    <span
                      className={cn("absolute top-0 h-2 rounded-full", c.score >= 0 ? "left-1/2 bg-accent" : "right-1/2 bg-terra")}
                      style={{ width: `${Math.min(50, Math.abs(c.score) * 50)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {(v.liked.length > 0 || v.disliked.length > 0) && (
            <section className="mb-6 space-y-3 rounded-2xl bg-card p-4">
              {v.liked.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
                    <Heart className="size-4 fill-terra text-terra" /> Os encanta
                  </p>
                  <Chips items={v.liked} className="bg-accent-soft text-accent" />
                </div>
              )}
              {v.disliked.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
                    <ThumbsDown className="size-4 text-muted" /> Convence menos
                  </p>
                  <Chips items={v.disliked} className="bg-fill text-muted" />
                </div>
              )}
              {v.typicalMinutes && (
                <p className="flex items-center gap-1.5 border-t border-hairline pt-3 text-[14px] text-muted">
                  <Clock className="size-4" /> Soléis cocinar platos de unos {v.typicalMinutes} minutos
                </p>
              )}
            </section>
          )}
        </>
      )}

      {v.rediscover.length > 0 && (
        <section className="mb-2">
          <h2 className="mb-1.5 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Para redescubrir</h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">
            {v.rediscover.map((r) => (
              <li key={r.id}>
                <Link href={`/recetas/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-fill">
                  <RecipePhoto photo={r.photo} title={r.title} className="size-12 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]">{r.title}</span>
                    <span className="block text-[13px] text-muted">{r.reason}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <IdeaGenerator
        aiEnabled={v.aiEnabled}
        mode="perfil"
        title="Platos nuevos para vosotros"
        subtitle="Recetas caseras originales, sencillas y de producto, pensadas según vuestros gustos y sin repetir las que ya tenéis."
      />
    </>
  );
}

function Chips({ items, className }: { items: string[]; className: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className={cn("rounded-full px-2.5 py-1 text-[13px] font-medium first-letter:uppercase", className)}>
          {i}
        </span>
      ))}
    </div>
  );
}
