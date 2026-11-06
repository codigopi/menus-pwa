"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronRight, Clock, Clock3, Sparkles } from "lucide-react";
import { suggestIdeas } from "@/app/(app)/gustos/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { Button } from "@/components/ui/button";
import { recipeToForm } from "@/lib/domain/recipe-form";
import { formatMinutes, totalMinutes } from "@/lib/domain/recipe";
import type { Idea } from "@/lib/ai/recipe-generator";

/**
 * Ideas de platos nuevos con IA. Al elegir una se abre el formulario para
 * revisarla y guardarla en el recetario.
 */
export function IdeaGenerator({
  aiEnabled,
  mode,
  ingredients,
  staples,
  title,
  subtitle,
}: {
  aiEnabled: boolean;
  mode: "perfil" | "ingredientes";
  ingredients?: string[];
  staples?: string[];
  title: string;
  subtitle: string;
}) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await suggestIdeas({ mode, ingredients, staples });
      if (res.error) setError(res.error);
      else setIdeas(res.ideas ?? []);
    });
  }

  return (
    <section className="mt-8 rounded-2xl bg-card p-4">
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-[14px] leading-snug">
          <p className="text-[16px] font-semibold">{title}</p>
          <p className="mt-0.5 text-muted">{subtitle}</p>
          {!aiEnabled && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
              <Clock3 className="size-3.5" /> Pendiente de configurar la IA
            </p>
          )}
        </div>
      </div>

      {aiEnabled && (
        <Button variant="secondary" className="mt-3 w-full" disabled={pending} onClick={generate}>
          <Sparkles className={pending ? "size-4 animate-pulse" : "size-4"} />
          {pending ? "Pensando platos…" : ideas ? "Otras ideas" : "Proponme platos"}
        </Button>
      )}

      {error && (
        <p className="mt-3 flex gap-2 text-[14px] text-terra">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {ideas && ideas.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
          {ideas.map((idea) => {
            const minutes = totalMinutes(idea.draft);
            return (
              <li key={idea.draft.title}>
                <button type="button" onClick={() => setSelected(idea)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-fill">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium">{idea.draft.title}</span>
                    {idea.draft.description && <span className="block text-[13px] leading-snug text-muted">{idea.draft.description}</span>}
                    {minutes !== null && (
                      <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                        <Clock className="size-3" /> {formatMinutes(minutes)}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Revisión a pantalla completa antes de guardar */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
          <div className="mx-auto max-w-2xl px-4">
            <RecipeForm
              initial={recipeToForm(selected.draft)}
              title="Nueva idea"
              onCancel={() => setSelected(null)}
              notice={
                <div className="mb-5 rounded-2xl bg-accent-soft p-4 text-[14px] leading-snug">
                  <p className="flex items-center gap-2 font-semibold">
                    <Sparkles className="size-4 text-accent" /> Receta propuesta por la IA · revísala antes de guardar
                  </p>
                  {selected.warnings.length > 0 && (
                    <ul className="mt-2 list-inside list-disc">
                      {selected.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
