import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportScreen } from "@/components/import/import-screen";
import { isAiConfigured } from "@/lib/ai/config";
import { extractFirstUrl } from "@/lib/importers/html";

export const metadata: Metadata = { title: "Importar receta" };

/**
 * /importar — también es el destino de "Compartir":
 *  - Android (Web Share Target): ?title=…&text=…&url=…  (el enlace suele venir dentro de text)
 *  - iPhone (Atajo): ?url=…
 */
export default function ImportPage({ searchParams }: PageProps<"/importar">) {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <WithParams searchParams={searchParams} />
    </Suspense>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/importar">["searchParams"] }) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
  const shared = [str(params.url), str(params.text), str(params.title)].filter(Boolean).join("\n");
  const url = extractFirstUrl(shared);
  // Texto compartido sin enlace (p. ej. desde Notas): se importa como texto.
  const text = !url && shared.length >= 20 ? shared : null;
  // Se lee aquí (tras searchParams, en tiempo de petición) y no en el build.
  const aiEnabled = isAiConfigured();
  return <ImportScreen initialUrl={url} initialText={aiEnabled ? text : null} aiEnabled={aiEnabled} />;
}
