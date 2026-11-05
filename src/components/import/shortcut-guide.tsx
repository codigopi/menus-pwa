"use client";

import { useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";

const noop = () => () => {};

/**
 * Instrucciones para crear un Atajo de iOS que añade "Cocina en Casa" al menú
 * Compartir de Instagram/TikTok (iOS no soporta Web Share Target).
 * Muestra la URL real de esta instalación.
 */
export function ShortcutGuide() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "https://tu-dominio");
  const target = `${origin}/importar?url=`;

  return (
    <details className="group mt-8 overflow-hidden rounded-2xl bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-7 place-items-center rounded-lg bg-[#5b8bd6] text-white">
          <Smartphone className="size-4" />
        </span>
        <span className="flex-1 text-[16px] font-medium">Compartir desde Instagram en iPhone</span>
        <span className="text-[13px] text-muted group-open:hidden">Ver cómo</span>
      </summary>
      <div className="border-t border-hairline px-4 py-4 text-[15px] leading-relaxed">
        <p className="mb-3 text-muted">
          En iPhone las apps web no aparecen en el menú Compartir. Con un Atajo (se crea una vez) sí:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Abre la app <b>Atajos</b> y toca <b>+</b> para crear uno nuevo.</li>
          <li>
            Toca el icono de información <b>ⓘ</b> y activa <b>«Mostrar en hoja de compartir»</b>. En tipos de entrada, deja
            solo <b>URL</b> y <b>Texto</b>.
          </li>
          <li>
            Añade la acción <b>«Codificar URL»</b> (busca «codificar») y que use la <b>Entrada del atajo</b>.
          </li>
          <li>
            Añade la acción <b>«Texto»</b> con esto y, justo al final, la variable <b>«URL codificada»</b>:
            <code className="mt-1.5 block rounded-lg bg-fill px-2.5 py-2 text-[13px] break-all">{target}</code>
          </li>
          <li>Añade la acción <b>«Abrir URLs»</b>.</li>
          <li>Llámalo <b>«Cocina en Casa»</b> y guarda.</li>
        </ol>
        <p className="mt-3 text-[13px] text-muted">
          Ahora en Instagram o TikTok: <b>Compartir → Cocina en Casa</b>. Se abrirá en Safari con la receta lista para
          revisar (si usas código de acceso, Safari lo pedirá la primera vez).
        </p>
      </div>
    </details>
  );
}
