import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatToCook } from "@/components/cook/what-to-cook";
import { PageHeader } from "@/components/ui/page-header";
import { isAiConfigured } from "@/lib/ai/config";
import { fetchRecipesForMatching } from "@/lib/recipes/queries";
import { listPantry } from "@/lib/shopping/service";

export const metadata: Metadata = { title: "¿Qué cocino?" };

export default function WhatToCookPage() {
  return (
    <>
      <PageHeader title="¿Qué cocino?" subtitle="Con lo que tienes en casa" />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-card" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const recipes = await fetchRecipesForMatching(); // tras connection(): tiempo de petición
  const pantry = listPantry().map((p) => p.name);
  return <WhatToCook recipes={recipes} aiEnabled={isAiConfigured()} pantry={pantry} />;
}
