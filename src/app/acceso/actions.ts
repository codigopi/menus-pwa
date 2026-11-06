"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessCode, accessToken, safeEqual, safeNextPath } from "@/lib/access";

export type AccessState = { error: string | null };

/** Comprueba el código y, si es correcto, guarda la cookie y vuelve a donde iba. */
export async function enter(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const code = accessCode();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!code) redirect(next);

  const attempt = String(formData.get("code") ?? "").trim();
  const [expected, given] = await Promise.all([accessToken(code), accessToken(attempt)]);
  if (!safeEqual(expected, given)) {
    // Pequeña pausa para frenar intentos por fuerza bruta.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Código incorrecto" };
  }

  // "secure" solo si se entra por HTTPS (Traefik/Dokploy lo indica en
  // x-forwarded-proto): con un dominio de pruebas en HTTP el navegador
  // descartaría la cookie y no habría forma de entrar.
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0].trim();
  (await cookies()).set(ACCESS_COOKIE, expected, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect(next);
}
