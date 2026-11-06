import type { Metadata } from "next";
import { Suspense } from "react";
import { ShoppingScreen } from "@/components/shopping/shopping-screen";
import { loadShoppingView } from "@/lib/shopping/view";

export const metadata: Metadata = { title: "Lista de la compra" };

export default function ShoppingPage({ searchParams }: PageProps<"/compra">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-2xl bg-card pt-14" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/compra">["searchParams"] }) {
  const { semana } = await searchParams;
  const view = await loadShoppingView(typeof semana === "string" ? semana : undefined);
  return <ShoppingScreen key={view.weekStart} view={view} />;
}
