import { defineConfig } from "drizzle-kit";

// Genera migraciones SQL versionadas en ./drizzle a partir del esquema TypeScript.
// Uso: `npm run db:generate` tras modificar src/lib/db/schema.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/app.db",
  },
});
