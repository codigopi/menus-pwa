import type { MetadataRoute } from "next";

/** Manifest de la PWA (se sirve en /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cocina en Casa",
    short_name: "Cocina",
    description: "Recetas, menú semanal y lista de la compra de casa.",
    lang: "es",
    start_url: "/recetas",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3ec",
    theme_color: "#f7f3ec",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: la app aparece en el menú "Compartir" (iOS no lo soporta: ver Atajo en /importar).
    share_target: {
      action: "/importar",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
