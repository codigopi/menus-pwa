import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessCode, accessToken, safeEqual } from "@/lib/access";

/**
 * Puerta de acceso opcional. Sin ACCESS_CODE, la app queda abierta.
 * Con él, cualquier petición sin la cookie correcta se redirige a /acceso
 * (o recibe 401 si es una llamada a /api).
 */
export async function proxy(request: NextRequest) {
  const code = accessCode();
  if (!code) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await accessToken(code))) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/acceso";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Excluye recursos públicos necesarios para instalar la PWA y la propia página de acceso.
  matcher: [
    "/((?!acceso|_next/static|_next/image|icons/|icon\\.svg|apple-icon|manifest\\.webmanifest|sw\\.js|offline\\.html|favicon\\.ico).*)",
  ],
};
