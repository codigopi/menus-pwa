# Imagen de producción para Dokploy (o cualquier Docker).
# Persistencia: monta un volumen en /data (SQLite + fotos).

# --- 1. Dependencias -------------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 es nativo: si no hay binario precompilado para esta versión
# de Node, se compila. Herramientas solo en esta etapa (no llegan a la imagen final).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --- 2. Build --------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- 3. Ejecución ----------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker pone en HOSTNAME el id del contenedor: forzamos escuchar en todas las interfaces.
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/app.db \
    UPLOADS_DIR=/data/uploads

RUN mkdir -p /data && chown node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Migraciones SQL: se aplican solas al arrancar.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
