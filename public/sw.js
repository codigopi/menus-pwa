/*
 * Service worker de Cocina en Casa (escrito a mano, sin dependencias).
 *
 * Estrategias:
 *  - /_next/static/* y /icons/*  → cache-first (ficheros con hash, inmutables)
 *  - /api/fotos/*                → cache-first (nombres UUID, inmutables)
 *  - Navegaciones (HTML)         → network-first; si no hay red, la última
 *                                  versión guardada de esa página o /offline.html
 *  - Resto (Server Actions, RSC) → red directa
 *
 * Para forzar la actualización en todos los dispositivos, sube VERSION.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const PHOTOS_CACHE = "photos"; // no depende de la versión: las fotos no cambian
const OFFLINE_URL = "/offline.html";
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGES_CACHE, PHOTOS_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    // No guardamos redirecciones (p. ej. a /acceso) para no cachear la página equivocada.
    if (response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone()).then(() => trimCache(PAGES_CACHE, MAX_PAGES));
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (url.pathname.startsWith("/api/fotos/")) {
    event.respondWith(cacheFirst(request, PHOTOS_CACHE));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
