# Cocina en Casa

PWA para gestionar las comidas y cenas de casa: recetas, importación desde redes, menú semanal, lista de la compra e histórico.

## Stack

- **Next.js 16** (App Router, Cache Components) + **TypeScript** + **Tailwind v4**
- **SQLite** (better-sqlite3) + **Drizzle ORM**, con migraciones automáticas al arrancar
- Fotos en disco (`UPLOADS_DIR`), servidas por `/api/fotos/[nombre]`
- **PWA**: manifest + service worker propio (`public/sw.js`) + página offline
- **Vitest** para la lógica de dominio (`src/lib/domain`)

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional: ajusta rutas o ACCESS_CODE
npm run dev                  # http://localhost:3000
```

La base de datos se crea sola en `./data/app.db` al abrir la primera página.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests unitarios y de integración (SQLite en memoria) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción (standalone) |
| `npm run db:generate` | Crea una migración tras cambiar `src/lib/db/schema.ts` |
| `npm run icons` | Regenera los iconos PNG desde `scripts/icon.svg` |

> El service worker solo se registra en producción. Para probar la PWA en local: `npm run build && npm start`.

## Estructura

```
src/
  app/(app)/          pantallas con barra de pestañas (recetas, menú, compra…)
  app/acceso/         pantalla del código de acceso
  app/api/fotos/      servidor de fotos
  components/ui/      componentes estilo iOS (cabecera, listas, hojas, estrellas…)
  components/recipes/ biblioteca, formulario y controles de receta
  lib/domain/         lógica pura + tests (unidades, cantidades, esquema de receta)
  lib/db/             conexión SQLite y esquema Drizzle
  lib/recipes/        repositorio de datos (+ test de integración)
  proxy.ts            puerta de acceso opcional (ACCESS_CODE)
drizzle/              migraciones SQL versionadas
```

## Despliegue en Dokploy

1. Crea una **Application** apuntando a este repositorio, con *Build Type* **Dockerfile**.
2. En **Advanced → Volumes / Mounts** añade un volumen con *Mount Path* `/data`. Ahí viven la base de datos y las fotos, y es lo único que hay que respaldar.
3. En **Environment** define al menos:
   ```
   ACCESS_CODE=un-codigo-que-solo-sepa-casa
   ```
   `DATABASE_PATH` y `UPLOADS_DIR` ya apuntan a `/data` dentro de la imagen.
4. En **Domains** asigna un dominio con HTTPS (Let's Encrypt). Es obligatorio para instalar la PWA. Puerto del contenedor: `3000`.
5. Despliega. Las migraciones se aplican solas al arrancar.

**Copia de seguridad:** con la app parada, o usando `sqlite3 /data/app.db ".backup /data/backup.db"`, copia `/data`.

## Instalar en el iPhone

Abre la URL en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.
