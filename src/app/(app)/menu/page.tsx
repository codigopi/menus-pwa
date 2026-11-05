import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Menú semanal" };

export default function Page() {
  return (
    <ComingSoon title="Menú" icon={<CalendarDays className="size-8" />} phase={4}>
      Comidas y cenas de la semana generadas automáticamente, con platos bloqueables y ajustes a mano.
    </ComingSoon>
  );
}
