/**
 * Ideas de platos nuevos con Claude: por gustos de la casa o a partir de
 * ingredientes sueltos ("¿Qué cocino?"). Solo servidor.
 *
 * La llamada al modelo se inyecta (`call`) para poder testear el prompt y la
 * normalización sin red ni clave.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { SUGGESTED_TAGS, type RecipeInput } from "@/lib/domain/recipe";
import { UNITS } from "@/lib/domain/units";
import { AiError } from "./recipe-extractor";
import { aiRecipeSchema, normalizeAiRecipe } from "./recipe-schema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const ideasSchema = z.object({ ideas: z.array(aiRecipeSchema) });
type AiIdeas = z.infer<typeof ideasSchema>;

const UNIT_GUIDE = UNITS.map((u) => u.key).join(", ");

// Estable (sin datos variables) para aprovechar la caché de prompts.
export const IDEAS_SYSTEM = `Eres el cocinero de confianza de "Cocina en Casa", una app doméstica española. Propones platos nuevos para el día a día de una casa.

Estilo: cocina casera española, sencilla y de producto, en la línea de los cocineros de televisión de toda la vida como Karlos Arguiñano: platos tradicionales o de inspiración tradicional, pocos pasos, ingredientes de mercado fáciles de encontrar, raciones generosas, buen aprovechamiento y trucos prácticos. Tono cercano.

Muy importante: las recetas deben ser ORIGINALES, creadas por ti. No reproduzcas recetas, títulos ni textos de programas, libros o webs de ningún cocinero; inspírate solo en el enfoque.

Reglas de formato:
- Todo en español de España, medidas métricas.
- Cada idea es una receta completa y realista: ingredientes con cantidades para las raciones indicadas y pasos claros en infinitivo o imperativo, sin numerar.
- "name" del ingrediente en minúsculas, sin cantidad; la preparación va en "note". Unidades: una de estas claves o null para piezas sueltas: ${UNIT_GUIDE}.
- Tiempos en minutos. Etiquetas (hasta 4) preferiblemente de: ${SUGGESTED_TAGS.join(", ")}.
- "description": una frase apetecible de por qué encaja.
- is_recipe siempre true, problem null; en "warnings" pon solo avisos útiles (p. ej. "si no tienes X, vale Y").
- Las ideas deben ser distintas entre sí (tipo de plato, técnica) y distintas de las recetas que ya tiene la casa.`;

export interface IdeasRequest {
  /** "perfil": según gustos; "ingredientes": aprovechar lo que hay. */
  mode: "perfil" | "ingredientes";
  ingredients?: string[];
  staples?: string[];
  profileText: string;
  existingTitles: string[];
  people: number;
  /** Niños en casa: platos que les gusten y sin pescados con mucho mercurio. */
  children?: number;
  vegetarian?: boolean;
  avoid?: string[];
  maxMinutes?: number | null;
  count?: number;
}

/** Mensaje de usuario (datos variables). Exportado para testearlo. */
export function buildIdeasPrompt(req: IdeasRequest): string {
  const count = req.count ?? 3;
  const lines: string[] = [];
  if (req.mode === "ingredientes") {
    lines.push(
      `Propón ${count} platos para hacer HOY aprovechando estos ingredientes que hay en casa: ${req.ingredients?.join(", ")}.`,
      `Úsalos como base; puedes añadir básicos de despensa (${(req.staples ?? []).join(", ") || "sal, aceite, especias"}) y, como mucho, 2 ingredientes más que haya que comprar (indícalo en warnings). Prioriza recetas de aprovechamiento.`,
    );
  } else {
    lines.push(`Propón ${count} platos nuevos que probablemente gusten en esta casa.`);
  }
  lines.push(`Gustos de la casa: ${req.profileText}`);
  lines.push(`Raciones: ${req.people}.`);
  if (req.children) {
    lines.push(`Hay ${req.children} niños en casa: platos que gusten a niños, sin picante, y sin pez espada, emperador, atún rojo, tiburón ni lucio.`);
  }
  if (req.maxMinutes) lines.push(`Tiempo total máximo: ${req.maxMinutes} minutos.`);
  if (req.vegetarian) lines.push("Dieta vegetariana: sin carne ni pescado (tampoco caldos de carne o pescado).");
  if (req.avoid?.length) lines.push(`Evita estos ingredientes: ${req.avoid.join(", ")}.`);
  if (req.existingTitles.length) lines.push(`Recetas que ya tienen (no las repitas): ${req.existingTitles.slice(0, 80).join("; ")}.`);
  return lines.join("\n");
}

type Caller = (system: string, user: string) => Promise<AiIdeas>;

let client: Anthropic | null = null;

/** Llamada real a Claude con salida estructurada. */
const callClaude: Caller = async (system, user) => {
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      // Creatividad con criterio: esfuerzo medio
      output_config: { effort: "medium", format: betaZodOutputFormat(ideasSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") throw new AiError("La IA no ha podido proponer platos ahora. Inténtalo de nuevo.");
    if (!response.parsed_output) throw new AiError("La IA devolvió una respuesta que no se pudo interpretar. Inténtalo de nuevo.");
    return response.parsed_output;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("La clave de la IA no es válida. Revisa ANTHROPIC_API_KEY.");
    if (err instanceof Anthropic.RateLimitError) throw new AiError("La IA está saturada ahora mismo. Espera un minuto y vuelve a intentarlo.");
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("No se pudo conectar con la IA.");
    if (err instanceof Anthropic.APIError) {
      console.error("[ia] ideas", err.status, err.message);
      throw new AiError("La IA ha fallado. Inténtalo de nuevo en un momento.");
    }
    if (err instanceof Anthropic.AnthropicError) throw new AiError("La IA no está configurada en el servidor: falta ANTHROPIC_API_KEY.");
    console.error("[ia] ideas inesperado", err);
    throw new AiError("No se pudieron generar ideas.");
  }
};

export interface Idea {
  draft: RecipeInput;
  warnings: string[];
}

export async function generateIdeas(req: IdeasRequest, call: Caller = callClaude): Promise<Idea[]> {
  const out = await call(IDEAS_SYSTEM, buildIdeasPrompt(req));
  const ideas = out.ideas
    .filter((i) => i.title.trim() && i.ingredients.length > 0)
    .slice(0, req.count ?? 3)
    .map((ai) => normalizeAiRecipe(ai, { sourceType: "generada", sourceUrl: null }))
    .map(({ draft, warnings }) => ({ draft: { ...draft, servings: draft.servings || req.people }, warnings }));
  if (ideas.length === 0) throw new AiError("No han salido ideas válidas. Inténtalo de nuevo.");
  return ideas;
}
