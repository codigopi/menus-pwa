import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Pantalla provisional para secciones de fases futuras. */
export function ComingSoon({ title, icon, phase, children }: { title: string; icon: ReactNode; phase: number; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={icon} title="Muy pronto">
        {children}
        <span className="mt-3 block text-[13px] font-medium text-accent">Llega en la fase {phase}</span>
      </EmptyState>
    </>
  );
}
