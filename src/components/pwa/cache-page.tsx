"use client";

import { useEffect } from "react";

/**
 * Pide al service worker que guarde esta página para abrirla sin conexión.
 * Necesario porque la navegación interna de Next no pasa por el evento
 * "navigate" del service worker, así que no se guardaría sola.
 */
export function CachePage({ url }: { url: string }) {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "cache-page", url });
  }, [url]);
  return null;
}
