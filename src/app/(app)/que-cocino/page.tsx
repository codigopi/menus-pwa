import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "¿Qué cocino?" };

export default function Page() {
  return (
    <ComingSoon title="¿Qué cocino?" icon={<Sparkles className="size-8" />} phase={3}>
      Dime qué tienes en la nevera y te propondré recetas de tu biblioteca o nuevas, priorizando el aprovechamiento.
    </ComingSoon>
  );
}
