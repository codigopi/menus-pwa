import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Clock, ExternalLink, Flame, NotebookPen, Timer, Users } from "lucide-react";
import { CookedButton } from "@/components/history/cooked-button";
import { StarRating } from "@/components/ui/star-rating";
import { ListGroup } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteRecipeButton, FavoriteButton, RatingControl } from "@/components/recipes/recipe-controls";
import { RecipePhoto } from "@/components/recipes/recipe-photo";
import { formatQuantity } from "@/lib/domain/quantity";
import { formatMinutes, SOURCE_LABELS, tagLabel, totalMinutes, type IngredientInput } from "@/lib/domain/recipe";
import { unitLabel } from "@/lib/domain/units";
import { logsForRecipe } from "@/lib/history/repo";
import { fetchRecipe } from "@/lib/recipes/queries";

/** "3 de noviembre de 2026" */
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export const metadata: Metadata = { title: "Receta" };

type Params = PageProps<"/recetas/[id]">["params"];

export default function RecipePage({ params }: PageProps<"/recetas/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <RecipeDetail params={params} />
    </Suspense>
  );
}

/** Agrupa ingredientes consecutivos por sección, conservando el orden. */
function groupIngredients(list: IngredientInput[]) {
  const groups: { label: string | null; items: IngredientInput[] }[] = [];
  for (const ing of list) {
    const last = groups.at(-1);
    if (last && last.label === ing.group) last.items.push(ing);
    else groups.push({ label: ing.group, items: [ing] });
  }
  return groups;
}

function amount(ing: IngredientInput): string {
  if (ing.quantity === null) return ing.unit ? unitLabel(ing.unit, 1) : "al gusto";
  return [formatQuantity(ing.quantity), unitLabel(ing.unit, ing.quantity)].filter(Boolean).join(" ");
}

async function RecipeDetail({ params }: { params: Params }) {
  const { id } = await params;
  const r = await fetchRecipe(id);
  if (!r) notFound();
  const logs = logsForRecipe(r.id);
  const lastNote = logs.find((l) => l.notes);

  const total = totalMinutes(r);
  const meta = [
    total !== null && { icon: Clock, label: formatMinutes(total), title: "Tiempo total" },
    r.prepMinutes !== null && r.cookMinutes !== null && { icon: Timer, label: `${r.prepMinutes} prep.`, title: "Preparación" },
    r.cookMinutes !== null && r.prepMinutes !== null && { icon: Flame, label: `${r.cookMinutes} cocción`, title: "Cocción" },
    { icon: Users, label: `${r.servings} ${r.servings === 1 ? "ración" : "raciones"}`, title: "Raciones" },
  ].filter(Boolean) as { icon: typeof Clock; label: string; title: string }[];

  return (
    <article>
      <PageHeader
        title={r.title}
        large={false}
        back={{ href: "/recetas", label: "Recetas" }}
        actions={
          <>
            <FavoriteButton id={r.id} isFavorite={r.isFavorite} />
            <Link href={`/recetas/${r.id}/editar`} className="tap px-1 text-[17px] text-accent">
              Editar
            </Link>
          </>
        }
      />

      <RecipePhoto photo={r.photo} title={r.title} priority className="mt-2 aspect-[16/10] w-full rounded-3xl" />

      <h1 className="mt-5 font-display text-[28px] leading-tight font-bold tracking-tight">{r.title}</h1>
      {r.description && <p className="mt-2 text-[16px] leading-relaxed text-muted">{r.description}</p>}

      <ul className="mt-4 flex flex-wrap gap-2">
        {meta.map(({ icon: Icon, label, title }) => (
          <li key={title} title={title} className="flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-[14px] font-medium">
            <Icon className="size-4 text-accent" /> {label}
          </li>
        ))}
      </ul>

      <div className="mt-4 mb-6 flex items-center justify-between gap-3">
        <RatingControl id={r.id} rating={r.rating} />
        {r.tags.length > 0 && (
          <ul className="flex flex-wrap justify-end gap-1.5">
            {r.tags.map((t) => (
              <li key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-accent">
                {tagLabel(t)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lo apuntado la última vez, a la vista antes de empezar */}
      {lastNote && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-terra-soft p-4">
          <NotebookPen className="mt-0.5 size-5 shrink-0 text-terra" />
          <div className="min-w-0 text-[15px] leading-snug">
            <p className="font-semibold">Tu nota del {longDate(lastNote.cookedOn)}</p>
            <p className="mt-0.5">«{lastNote.notes}»</p>
          </div>
        </div>
      )}

      {r.ingredients.length > 0 &&
        groupIngredients(r.ingredients).map((g, gi) => (
          <ListGroup key={gi} header={g.label ?? (gi === 0 ? "Ingredientes" : undefined)}>
            {g.items.map((ing, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <span className="block text-[17px] first-letter:uppercase">{ing.name}</span>
                  {ing.note && <span className="block text-[14px] text-muted">{ing.note}</span>}
                </div>
                <span className="shrink-0 text-[16px] text-muted tabular-nums">{amount(ing)}</span>
              </div>
            ))}
          </ListGroup>
        ))}

      {r.steps.length > 0 && (
        <ListGroup header="Preparación">
          {r.steps.map((s, i) => (
            <div key={i} className="flex gap-3.5 px-4 py-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-accent-ink">
                {i + 1}
              </span>
              <p className="pt-0.5 text-[17px] leading-relaxed whitespace-pre-line">{s.text}</p>
            </div>
          ))}
        </ListGroup>
      )}

      {r.sourceUrl && (
        <ListGroup header="Origen">
          <a
            href={r.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 px-4 py-2.5 active:bg-fill"
          >
            <span className="min-w-0 flex-1 truncate text-[17px] text-accent">Ver original</span>
            <span className="text-[15px] text-muted">{SOURCE_LABELS[r.sourceType]}</span>
            <ExternalLink className="size-4 text-muted" />
          </a>
        </ListGroup>
      )}

      <div className="mb-7">
        <CookedButton recipe={{ id: r.id, title: r.title }} />
      </div>

      {logs.length > 0 && (
        <ListGroup header={`Cuando la cocinaste · ${logs.length}`}>
          {logs.slice(0, 10).map((l) => (
            <div key={l.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px]">{longDate(l.cookedOn)}</span>
                {l.rating && <StarRating value={l.rating} size="sm" />}
              </div>
              {l.notes && <p className="mt-1 text-[15px] leading-snug text-muted">«{l.notes}»</p>}
            </div>
          ))}
        </ListGroup>
      )}

      <DeleteRecipeButton id={r.id} title={r.title} />
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="animate-pulse pt-14">
      <div className="aspect-[16/10] w-full rounded-3xl bg-fill" />
      <div className="mt-5 h-8 w-2/3 rounded-lg bg-fill" />
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-20 rounded-full bg-fill" />
        <div className="h-8 w-24 rounded-full bg-fill" />
      </div>
      <div className="mt-6 h-40 rounded-2xl bg-card" />
    </div>
  );
}
