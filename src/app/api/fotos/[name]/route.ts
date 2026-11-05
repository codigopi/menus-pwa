import { readPhoto } from "@/lib/storage/photos";

/**
 * Sirve las fotos subidas desde el volumen de datos.
 * Los nombres son UUID únicos, así que la respuesta se cachea para siempre.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/fotos/[name]">) {
  const { name } = await ctx.params;
  const photo = await readPhoto(name);
  if (!photo) return new Response("No encontrada", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
