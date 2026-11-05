import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cocina en Casa", template: "%s · Cocina en Casa" },
  description: "Recetas, menú semanal y lista de la compra de casa.",
  applicationName: "Cocina en Casa",
  // Ajustes para "Añadir a pantalla de inicio" en iPhone.
  appleWebApp: {
    capable: true,
    title: "Cocina",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa toda la pantalla (bajo el notch); usamos safe-area en los márgenes.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
