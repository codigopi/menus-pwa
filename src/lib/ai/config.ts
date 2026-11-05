/**
 * ¿Está configurada la IA? (hay ANTHROPIC_API_KEY en el entorno del servidor)
 *
 * Mientras no lo esté, la app funciona igual salvo las funciones de IA, que
 * se muestran como "pendientes de configurar" en vez de fallar.
 *
 * OJO con Cache Components: llamar a esto solo desde código que se ejecute en
 * tiempo de petición (tras `connection()`, `searchParams`, en Server Actions…).
 * Si se leyera durante el prerender del build, quedaría fijado el valor del
 * build (sin clave) aunque luego se configure en Dokploy.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export const AI_PENDING_MESSAGE =
  "La IA está pendiente de configurar (falta la clave ANTHROPIC_API_KEY en el servidor).";
