import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-safe">
      <EmptyState
        icon={<SearchX className="size-8" />}
        title="No encontramos esto"
        action={<LinkButton href="/recetas">Volver a recetas</LinkButton>}
      >
        Puede que la receta se haya borrado o que el enlace no sea correcto.
      </EmptyState>
    </main>
  );
}
