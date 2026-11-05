import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RecipeLibrary } from "@/components/recipes/recipe-library";
import { fetchRecipes } from "@/lib/recipes/queries";
import Link from "next/link";

export const metadata: Metadata = { title: "Recetas" };

export default function RecipesPage() {
  return (
    <>
      <PageHeader
        title="Recetas"
        actions={
          <>
            <Link href="/importar" aria-label="Importar receta" className="tap grid size-9 place-items-center text-accent">
              <Sparkles className="size-6" strokeWidth={2} />
            </Link>
            <Link href="/recetas/nueva" aria-label="Nueva receta" className="tap grid size-9 place-items-center text-accent">
              <Plus className="size-7" strokeWidth={2.2} />
            </Link>
          </>
        }
      />
      {/* La cabecera forma parte del "shell" estático; la lista llega en streaming. */}
      <Suspense fallback={<LibrarySkeleton />}>
        <Library />
      </Suspense>
    </>
  );
}

async function Library() {
  const recipes = await fetchRecipes();
  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-8" />}
        title="Tu recetario está vacío"
        action={
          <div className="flex flex-col gap-2.5">
            <LinkButton href="/importar">
              <Sparkles className="size-5" /> Importar desde un enlace
            </LinkButton>
            <LinkButton href="/recetas/nueva" variant="plain">
              <Plus className="size-5" /> Escribirla a mano
            </LinkButton>
          </div>
        }
      >
        Empieza guardando ese plato que siempre sale bien, o importa una receta de Instagram, TikTok, YouTube o cualquier web.
      </EmptyState>
    );
  }
  return <RecipeLibrary recipes={recipes} />;
}

function LibrarySkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mb-3 h-10 rounded-xl bg-fill" />
      <div className="mb-4 flex gap-2">
        {[64, 80, 72].map((w) => (
          <div key={w} className="h-8 rounded-full bg-fill" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-card">
            <div className="aspect-[4/3] bg-fill" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-fill" />
              <div className="h-3 w-1/3 rounded bg-fill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
