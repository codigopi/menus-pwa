"use client"; // Los límites de error deben ser Client Components

import { useEffect } from "react";
import { CloudOff, RotateCw, TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

/** Pantalla amable si algo falla al cargar una sección (sin red, error del servidor…). */
export default function SectionError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="flex flex-col items-center px-6 pt-24 pb-10 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-terra-soft text-terra">
        {offline ? <CloudOff className="size-8" /> : <TriangleAlert className="size-8" />}
      </div>
      <h2 className="mb-1.5 text-[20px] font-semibold">{offline ? "Sin conexión" : "Algo no ha ido bien"}</h2>
      <p className="mb-6 max-w-xs text-[15px] leading-snug text-muted">
        {offline
          ? "Esta pantalla necesita conexión. La lista de la compra sí funciona sin red."
          : "No se ha podido cargar esta pantalla. Vuelve a intentarlo en un momento."}
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button size="lg" onClick={() => retry()}>
          <RotateCw className="size-5" /> Reintentar
        </Button>
        <LinkButton href="/compra" variant="plain">
          Ir a la lista de la compra
        </LinkButton>
      </div>
    </div>
  );
}
