import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { History, Info, Settings, Smartphone, Sparkles } from "lucide-react";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { isAiConfigured } from "@/lib/ai/config";

export const metadata: Metadata = { title: "Más" };

const iconBox = (bg: string, icon: ReactNode) => (
  <span className={`grid size-7 place-items-center rounded-lg text-white ${bg}`}>{icon}</span>
);

export default function Page() {
  return (
    <>
      <PageHeader title="Más" />
      <ListGroup>
        <ListRow icon={iconBox("bg-terra", <History className="size-4" />)} title="Histórico" href="/historico" />
        <ListRow icon={iconBox("bg-accent", <Settings className="size-4" />)} title="Tus gustos" href="/gustos" />
      </ListGroup>
      <ListGroup
        header="Inteligencia artificial"
        footer="Se usa para importar desde redes, texto o capturas, proponer recetas nuevas en «¿Qué cocino?» y en «Tus gustos». Se activa añadiendo ANTHROPIC_API_KEY en el servidor."
      >
        <ListRow
          icon={iconBox("bg-[#8a6fd1]", <Sparkles className="size-4" />)}
          title="Estado"
          detail={
            <Suspense fallback="…">
              <AiStatus />
            </Suspense>
          }
        />
      </ListGroup>
      <ListGroup
        header="Instalar en el iPhone"
        footer="En Safari: botón Compartir → «Añadir a pantalla de inicio». Se abrirá a pantalla completa, como una app."
      >
        <ListRow icon={iconBox("bg-[#5b8bd6]", <Smartphone className="size-4" />)} title="Cocina en Casa como app" />
      </ListGroup>
      <ListGroup>
        <ListRow icon={iconBox("bg-muted", <Info className="size-4" />)} title="Versión" detail="1.0" />
      </ListGroup>
    </>
  );
}

/** Se evalúa en cada petición (no en el build) para reflejar la clave del servidor. */
async function AiStatus() {
  await connection();
  return isAiConfigured() ? <span className="text-accent">Activa</span> : "Pendiente de clave";
}
