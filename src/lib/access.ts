/**
 * Código de acceso compartido (sin cuentas de usuario).
 *
 * Si ACCESS_CODE está definido, la cookie guarda un hash del código (nunca el
 * código en claro). Cambiar ACCESS_CODE invalida todas las cookies existentes.
 * Funciona tanto en el runtime del proxy como en Node (usa Web Crypto).
 */
export const ACCESS_COOKIE = "cec_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

export function accessCode(): string | null {
  const code = process.env.ACCESS_CODE?.trim();
  return code ? code : null;
}

export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`cocina-en-casa:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante para no filtrar información por tiempos. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Solo permitimos redirigir a rutas internas ("/algo", nunca "//dominio"). */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/recetas";
}
