import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Navegación por semanas (menú y compra). */
export function WeekNav({
  basePath,
  rangeLabel,
  prevWeek,
  nextWeek,
  isCurrentWeek,
}: {
  basePath: string;
  rangeLabel: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
}) {
  return (
    <nav className="mb-4 flex items-center justify-between rounded-2xl bg-card px-2 py-1.5" aria-label="Semana">
      <Link href={`${basePath}?semana=${prevWeek}`} aria-label="Semana anterior" className="tap grid size-10 place-items-center text-accent">
        <ChevronLeft className="size-6" />
      </Link>
      <div className="text-center">
        <p className="text-[17px] font-semibold">{rangeLabel}</p>
        <p className="text-[12px] text-muted">
          {isCurrentWeek ? "Esta semana" : <Link href={basePath} className="text-accent">Volver a esta semana</Link>}
        </p>
      </div>
      <Link href={`${basePath}?semana=${nextWeek}`} aria-label="Semana siguiente" className="tap grid size-10 place-items-center text-accent">
        <ChevronRight className="size-6" />
      </Link>
    </nav>
  );
}
