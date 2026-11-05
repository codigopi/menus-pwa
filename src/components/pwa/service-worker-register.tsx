"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js solo en producción (en desarrollo el SW cachearía código
 * antiguo y confundiría al recargar).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.warn("No se pudo registrar el service worker", err));
  }, []);
  return null;
}
