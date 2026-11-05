"use server";

import { cookies } from "next/headers";
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

  (await cookies()).set(ACCESS_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect(next);
}
