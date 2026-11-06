/**
 * Se ejecuta una vez al arrancar el servidor. Programa tareas de
 * mantenimiento ligeras (sin bloquear el arranque):
 *  - limpieza de fotos huérfanas al minuto de arrancar y luego cada 24 h.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // nada durante el build

  const run = async () => {
    try {
      const { cleanupOrphanPhotos } = await import("@/lib/maintenance/orphan-photos");
      const deleted = await cleanupOrphanPhotos();
      if (deleted.length) console.log(`[mantenimiento] ${deleted.length} fotos huérfanas borradas`);
    } catch (err) {
      console.error("[mantenimiento] error limpiando fotos", err);
    }
  };

  // .unref(): los temporizadores no mantienen vivo el proceso por sí solos
  setTimeout(run, 60_000).unref();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}
