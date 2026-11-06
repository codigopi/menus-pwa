# Cocina en Casa

PWA para gestionar las comidas y cenas de casa: recetario, importación desde redes, «¿qué cocino con lo que tengo?», menú semanal, lista de la compra con despensa, histórico y sugerencias según vuestros gustos. Interfaz en español, pensada para iPhone.

## Funciones

| Sección | Qué hace | ¿Necesita IA? |
| --- | --- | --- |
| **Recetas** | Crear, editar, foto, ingredientes con secciones, pasos, etiquetas, favoritas, valoración. Búsqueda instantánea. «Lo he cocinado» con notas. | No |
| **Importar** | Webs con datos estructurados (la mayoría de recetarios) | No |
| | Instagram, TikTok, YouTube, texto pegado y capturas de pantalla | Sí |
| **¿Qué cocino?** | Recetas de tu biblioteca con lo que tienes, qué te falta, básicos editables, añadir lo de la despensa | No |
| | Recetas nuevas inventadas con esos ingredientes | Sí |
| **Menú** | Semana automática equilibrada (variedad, cenas ligeras, tiempo, vegetariano, alimentos a evitar, presupuesto con coste estimado, gustos). Bloquear, regenerar, elegir a mano, sobras, comer fuera, marcar cocinado. | No |
| **Compra** | Lista desde el menú: escalada, fusionada, por secciones del súper, restando la despensa. Casillas, añadir a mano, compartir, coste orientativo. **Funciona sin conexión.** | No |
| **Histórico** | Qué se cocinó y cuándo, valoraciones, notas, estadísticas | No |
| **Tus gustos** | Perfil aprendido de valoraciones e histórico; recetas para redescubrir | No |
| | Ideas de platos nuevos (cocina casera tradicional, originales) | Sí |

Sin `ANTHROPIC_API_KEY` todo funciona salvo lo marcado con IA, que aparece como «pendiente de configurar».

## Stack

- **Next.js 16** (App Router, Cache Components) + **TypeScript** + **Tailwind v4**, UI estilo iOS
- **SQLite** (better-sqlite3) + **Drizzle ORM**, migraciones automáticas al arrancar
- **Claude API** (`@anthropic-ai/sdk`) con salidas estructuradas (Zod) para importar y proponer recetas
- **PWA**: manifest, service worker propio (`public/sw.js`), página offline, Web Share Target (Android)
- **Vitest** (lógica de dominio e integración con SQLite en memoria)

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional
npm run dev                  # http://localhost:3000
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests (dominio + integración) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción (standalone) |
| `npm run db:generate` | Crea una migración tras cambiar `src/lib/db/schema.ts` |
| `npm run icons` | Regenera los iconos desde `scripts/icon.svg` |

> El service worker solo se registra en producción: `npm run build && npm start` para probar la PWA y el modo sin conexión.

## Variables de entorno

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `DATABASE_PATH` | `./data/app.db` (`/data/app.db` en Docker) | Fichero SQLite |
| `UPLOADS_DIR` | `./data/uploads` (`/data/uploads` en Docker) | Fotos de recetas |
| `ACCESS_CODE` | — | Código de acceso de la casa (muy recomendable si la URL es pública) |
| `ANTHROPIC_API_KEY` | — | Activa las funciones de IA |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Modelo de IA (`claude-sonnet-5-5` o `claude-haiku-5-5` para abaratar) |
| `APP_TIMEZONE` | `Europe/Madrid` | Zona horaria para «hoy» y las semanas del menú |

## Estructura

```
src/
  app/(app)/            pantallas con barra de pestañas
    recetas/ importar/ que-cocino/ menu/ compra/ historico/ gustos/ mas/
  app/acceso/           código de acceso
  app/api/fotos/        servidor de fotos
  components/           UI estilo iOS y componentes por sección
  lib/domain/           LÓGICA PURA + tests: unidades, cantidades, ingredientes,
                        catálogo/secciones/precios, lista de la compra, menú,
                        emparejado «qué cocino», gustos, estadísticas, fechas
  lib/ai/               extracción e ideas con Claude (salida estructurada)
  lib/importers/        JSON-LD, redes sociales, descarga segura (anti-SSRF)
  lib/{recipes,menu,shopping,history,taste}/   datos y casos de uso por sección
  lib/offline/          cola de cambios de la compra sin conexión
  lib/maintenance/      limpieza de fotos huérfanas (cada 24 h)
  proxy.ts              puerta del código de acceso
  instrumentation.ts    tareas de mantenimiento al arrancar
drizzle/                migraciones SQL versionadas
```

## Despliegue en Dokploy

1. **Application** apuntando a este repositorio, *Build Type* **Dockerfile**.
2. **Volumes / Mounts**: volumen con *Mount Path* `/data` (base de datos y fotos: lo único que hay que respaldar).
3. **Environment**: al menos `ACCESS_CODE=…`; y `ANTHROPIC_API_KEY=…` para la IA.
4. **Domains**: dominio con HTTPS (obligatorio para instalar la PWA). Puerto `3000`.
   Con el dominio gratuito de Dokploy (`*.traefik.me`, solo HTTP) la app funciona, pero sin modo
   sin conexión: el navegador no activa el service worker fuera de HTTPS.
5. Desplegar. Las migraciones se aplican solas.

**Copia de seguridad**: copia `/data` (con la app parada) o `sqlite3 /data/app.db ".backup /data/backup.db"`.

## En el iPhone

- **Instalar**: Safari → Compartir → «Añadir a pantalla de inicio».
- **Compartir desde Instagram/TikTok**: iOS no permite que las apps web aparezcan en «Compartir»; en *Importar* hay una guía para crear un Atajo que lo hace (se configura una vez).
- **Sin conexión**: la lista de la compra funciona sin red (marcar, añadir, quitar) y se sincroniza al volver.
