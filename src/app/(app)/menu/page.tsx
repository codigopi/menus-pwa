import type { Metadata } from "next";
import { Suspense } from "react";
import { WeekMenu } from "@/components/menu/week-menu";
import { loadMenuView } from "@/lib/menu/view";

export const metadata: Metadata = { title: "Menú semanal" };

/** /menu?semana=YYYY-MM-DD (cualquier día de la semana; por defecto, la actual). */
export default function MenuPage({ searchParams }: PageProps<"/menu">) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/menu">["searchParams"] }) {
  const { semana } = await searchParams;
  const view = await loadMenuView(typeof semana === "string" ? semana : undefined);
  // key: al cambiar de semana se reinicia el estado local (hojas abiertas, etc.)
  return <WeekMenu key={view.weekStart} view={view} />;
}

function MenuSkeleton() {
  return (
    <div aria-hidden className="animate-pulse pt-14">
      <div className="mb-4 h-9 w-32 rounded-lg bg-fill" />
      <div className="mb-4 h-14 rounded-2xl bg-card" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5">
          <div className="mb-2 h-4 w-24 rounded bg-fill" />
          <div className="h-32 rounded-2xl bg-card" />
        </div>
      ))}
    </div>
  );
}
