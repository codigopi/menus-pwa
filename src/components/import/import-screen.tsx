"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, ClipboardPaste, Clock3, FileText, ImagePlus, Link2, Sparkles, X, Zap } from "lucide-react";
import { importRecipe } from "@/app/(app)/importar/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { recipeToForm } from "@/lib/domain/recipe-form";
import { compressImage } from "@/lib/image/compress";
import type { ImportResult } from "@/lib/importers/import-recipe";
import { ShortcutGuide } from "./shortcut-guide";

type Mode = "enlace" | "texto" | "captura";
type Success = Extract<ImportResult, { ok: true }>;

const MAX_IMAGES = 3;

const LOADING_STEPS: Record<Mode, string[]> = {
  enlace: ["Abriendo el enlace…", "Buscando la receta…", "Ordenando ingredientes y pasos…", "Casi está…"],
  texto: ["Leyendo el texto…", "Ordenando ingredientes y pasos…", "Casi está…"],
  captura: ["Mirando las capturas…", "Leyendo ingredientes…", "Ordenando los pasos…", "Casi está…"],
};

/**
 * Importador: enlace, texto pegado o capturas → borrador editable.
 * `initialUrl` / `initialText` llegan cuando se comparte desde otra app
 * (Web Share Target en Android, Atajo en iPhone) y lanzan la importación sola.
 */
export function ImportScreen({
  initialUrl,
  initialText,
  aiEnabled,
}: {
  initialUrl: string | null;
  initialText: string | null;
  /** false mientras no haya clave de IA: solo funcionan webs con datos estructurados. */
  aiEnabled: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialUrl ? "enlace" : initialText ? "texto" : "enlace");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState(initialText ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [error, setError] = useState<{ message: string; suggest?: Mode } | null>(null);
  const [result, setResult] = useState<Success | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);

  function run(runMode: Mode = mode) {
    const fd = new FormData();
    fd.set("mode", runMode);
    if (runMode === "enlace") fd.set("url", url.trim());
    if (runMode === "texto") {
      fd.set("text", text);
      fd.set("url", sourceUrl.trim());
    }
    if (runMode === "captura") {
      images.forEach((img) => fd.append("images", img.file));
      fd.set("url", sourceUrl.trim());
    }
    setError(null);
    startTransition(async () => {
      const res = await importRecipe(fd);
      if (res.ok) {
        setResult(res);
        window.scrollTo({ top: 0 });
      } else {
        setError({ message: res.error, suggest: res.suggest });
      }
    });
  }

  // Lanzamiento automático al llegar desde "Compartir".
  useEffect(() => {
    if (autoStarted.current || (!initialUrl && !initialText)) return;
    autoStarted.current = true;
    run(initialUrl ? "enlace" : "texto");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo una vez, al montar
  }, []);

  async function addImages(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, room);
    const prepared = await Promise.all(
      picked.map(async (f) => {
        const small = await compressImage(f, 2000, 0.85); // legible para leer texto
        return { file: small, preview: URL.createObjectURL(small) };
      }),
    );
    setImages((prev) => [...prev, ...prepared]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeImage(i: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function pasteUrl() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setUrl(clip.trim());
    } catch {
      // Sin permiso de portapapeles: el usuario puede pegar a mano.
    }
  }

  // ---- Revisión del borrador ----------------------------------------------
  if (result) {
    return (
      <RecipeForm
        initial={recipeToForm(result.draft)}
        draftPhoto={result.photo}
        title="Revisar receta"
        onCancel={() => setResult(null)}
        notice={<ImportNotice result={result} />}
      />
    );
  }

  // ---- Formulario de importación -------------------------------------------
  const aiMode = mode === "texto" || mode === "captura";
  const canRun =
    !pending &&
    !(aiMode && !aiEnabled) &&
    ((mode === "enlace" && url.trim().length > 8) ||
      (mode === "texto" && text.trim().length >= 20) ||
      (mode === "captura" && images.length > 0));

  return (
    <>
      <PageHeader title="Importar" back={{ href: "/recetas", label: "Recetas" }} subtitle="Desde una web, Instagram, TikTok o YouTube" />

      <Segmented
        label="Cómo importar"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "enlace", label: <><Link2 className="size-4" /> Enlace</> },
          { value: "texto", label: <><FileText className="size-4" /> Texto</> },
          { value: "captura", label: <><Camera className="size-4" /> Captura</> },
        ]}
      />

      {!aiEnabled && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-fill p-4 text-[14px] leading-snug">
          <Clock3 className="mt-0.5 size-5 shrink-0 text-muted" />
          <p>
            <b>IA pendiente de configurar.</b> De momento se importan las webs de recetas que publican sus datos
            (la mayoría de recetarios). Instagram, TikTok, YouTube, texto y capturas se activarán al añadir la clave.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-card p-4">
        {aiMode && !aiEnabled && (
          <p className="mb-3 rounded-xl bg-fill px-3 py-2 text-[14px] text-muted">
            Este modo usa IA: estará disponible cuando se configure la clave.
          </p>
        )}
        {mode === "enlace" && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/…"
                aria-label="Enlace de la receta"
                enterKeyHint="go"
                onKeyDown={(e) => e.key === "Enter" && canRun && run()}
                className="h-11 min-w-0 flex-1 rounded-xl bg-fill px-3 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent/30"
              />
              <button type="button" onClick={pasteUrl} className="tap flex h-11 items-center gap-1.5 rounded-xl bg-accent-soft px-3 text-[15px] font-medium text-accent">
                <ClipboardPaste className="size-4" /> Pegar
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Las webs de recetas suelen funcionar al momento. En Instagram y TikTok depende de si dejan leer el texto del
              post; si no, te propondré pegarlo o subir una captura.
            </p>
          </>
        )}

        {mode === "texto" && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pega aquí la descripción del vídeo o el texto de la receta…"
              aria-label="Texto de la receta"
              rows={8}
              className="w-full resize-y rounded-xl bg-fill p-3 leading-snug outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent/30"
            />
            <SourceUrlInput value={sourceUrl} onChange={setSourceUrl} />
          </>
        )}

        {mode === "captura" && (
          <>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={img.preview} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-fill">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`Captura ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="Quitar captura"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/50 text-white"
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="tap flex aspect-[9/16] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-fill-strong text-muted"
                >
                  <ImagePlus className="size-6" strokeWidth={1.6} />
                  <span className="text-[13px] font-medium">Añadir</span>
                </button>
              )}
            </div>
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Hasta 3 capturas de la misma receta (por ejemplo, ingredientes y pasos). Tip: en Instagram abre «más» en la
              descripción antes de hacer la captura.
            </p>
            <SourceUrlInput value={sourceUrl} onChange={setSourceUrl} />
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-2xl bg-terra-soft p-4">
          <p className="flex gap-2 text-[15px] leading-snug">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-terra" />
            {error.message}
          </p>
          {aiEnabled && error.suggest && error.suggest !== mode && (
            <Button variant="secondary" className="mt-3" onClick={() => { setMode(error.suggest!); setError(null); }}>
              {error.suggest === "texto" ? <><FileText className="size-4" /> Pegar el texto</> : <><Camera className="size-4" /> Subir captura</>}
            </Button>
          )}
        </div>
      )}

      <div className="mt-5">
        {pending ? <LoadingCard mode={mode} /> : (
          <Button size="lg" disabled={!canRun} onClick={() => run()}>
            <Sparkles className="size-5" /> Importar receta
          </Button>
        )}
      </div>

      <ShortcutGuide />
    </>
  );
}

function SourceUrlInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="url"
      inputMode="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enlace de origen (opcional)"
      aria-label="Enlace de origen"
      className="mt-3 h-10 w-full rounded-xl bg-fill px-3 text-[15px] outline-none placeholder:text-muted/70"
    />
  );
}

/** Tarjeta de carga con mensajes que van cambiando (la IA tarda unos segundos). */
function LoadingCard({ mode }: { mode: Mode }) {
  const steps = LOADING_STEPS[mode];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 2600);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4" aria-live="polite">
      <span className="size-6 shrink-0 animate-spin rounded-full border-[3px] border-accent-soft border-t-accent" />
      <span className="text-[16px]">{steps[i]}</span>
    </div>
  );
}

function ImportNotice({ result }: { result: Success }) {
  return (
    <div className={cn("mb-5 rounded-2xl p-4", result.warnings.length ? "bg-terra-soft" : "bg-accent-soft")}>
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        {result.via === "datos-web" ? <Zap className="size-4 text-accent" /> : <Sparkles className="size-4 text-accent" />}
        {result.via === "datos-web" ? "Leída directamente de la web" : "Interpretada con IA"} · revísala antes de guardar
      </p>
      {result.warnings.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[14px] leading-snug">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
