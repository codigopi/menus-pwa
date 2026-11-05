import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontenido para Docker/Dokploy: genera .next/standalone con un server.js mínimo.
  output: "standalone",

  // Cache Components + Partial Prefetching (por defecto en Next 16.4).
  // Nota: las lecturas de SQLite son síncronas, por eso el repositorio llama a
  // `connection()` antes de consultar (si no, se "congelarían" en el build).
  cacheComponents: true,
  partialPrefetching: true,

  // better-sqlite3 es un módulo nativo: no debe empaquetarse.
  serverExternalPackages: ["better-sqlite3"],

  experimental: {
    serverActions: {
      // Las fotos se comprimen en el cliente (~300 KB), pero dejamos margen.
      bodySizeLimit: "6mb",
    },
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
