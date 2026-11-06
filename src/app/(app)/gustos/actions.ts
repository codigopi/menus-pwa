"use server";

import { z } from "zod";
import { AI_PENDING_MESSAGE, isAiConfigured } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/recipe-extractor";
import { generateIdeas, type Idea } from "@/lib/ai/recipe-generator";
import { describeProfile } from "@/lib/domain/taste";
import { latestParams } from "@/lib/menu/repo";
import { loadTaste } from "@/lib/taste/service";

const requestSchema = z.object({
  mode: z.enum(["perfil", "ingredientes"]),
  ingredients: z.array(z.string().max(60)).max(30).optional(),
  staples: z.array(z.string().max(60)).max(30).optional(),
});

/** Propone platos nuevos (IA) según los gustos o con ingredientes sueltos. */
export async function suggestIdeas(input: z.input<typeof requestSchema>): Promise<{ ideas?: Idea[]; error?: string }> {
  if (!isAiConfigured()) return { error: AI_PENDING_MESSAGE };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: "Petición no válida" };
  if (parsed.data.mode === "ingredientes" && !parsed.data.ingredients?.length) return { error: "Añade algún ingrediente" };

  const { recipes, profile } = loadTaste();
  const params = latestParams();
  try {
    const ideas = await generateIdeas({
      mode: parsed.data.mode,
      ingredients: parsed.data.ingredients,
      staples: parsed.data.staples,
      profileText: describeProfile(profile),
      existingTitles: recipes.map((r) => r.title),
      people: params.people,
      vegetarian: params.vegetarian,
      avoid: params.avoid,
      maxMinutes: parsed.data.mode === "ingredientes" ? params.maxMinutesWeekday : null,
    });
    return { ideas };
  } catch (err) {
    if (err instanceof AiError) return { error: err.message };
    console.error("[ideas]", err);
    return { error: "No se pudieron generar ideas." };
  }
}
