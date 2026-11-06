import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryScreen } from "@/components/history/history-screen";
import { loadHistoryView } from "@/lib/history/view";

export const metadata: Metadata = { title: "Histórico" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-2xl bg-card pt-14" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  return <HistoryScreen view={await loadHistoryView()} />;
}
