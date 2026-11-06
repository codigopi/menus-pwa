"use client";

/**
 * Lista de la compra que funciona sin conexión.
 *
 *  - Cada cambio (marcar, añadir, quitar) se guarda primero en una cola en el
 *    móvil y se aplica al instante en pantalla.
 *  - La cola se envía al servidor en cuanto hay red (y al recuperarla).
 *  - Se guarda una copia de la última lista recibida para abrirla sin red.
 *
 * El servidor aplica la cola de forma idempotente (ver applyOps), así que
 * reenviar tras un corte no duplica nada.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { syncShopping } from "@/app/(app)/compra/actions";
import { manualEntry } from "@/lib/domain/shopping";
import { readPersistent, usePersistentState, writePersistent } from "@/lib/hooks/use-persistent-list";
import type { ShoppingOp } from "@/lib/shopping/service";
import type { ShoppingItemView, ShoppingView } from "@/lib/shopping/view";

type LocalOp = ShoppingOp & { syncedAt?: number };
interface Snapshot {
  renderedAt: number;
  items: ShoppingItemView[];
}

const EMPTY_OPS: LocalOp[] = [];
const isOps = (v: unknown): v is LocalOp[] => Array.isArray(v);
const isSnapshot = (v: unknown): v is Snapshot | null =>
  v === null || (typeof v === "object" && v !== null && Array.isArray((v as Snapshot).items));

const opsKey = (week: string) => `cec:compra:ops:${week}`;
const snapKey = (week: string) => `cec:compra:snap:${week}`;
const opId = (o: ShoppingOp) => `${o.type}:${o.id}:${o.at}`;
/** Id para lo añadido a mano. crypto.randomUUID solo existe en HTTPS: en HTTP (dominio de pruebas), alternativa. */
const newId = () => globalThis.crypto?.randomUUID?.() ?? `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Aplica la cola local sobre la lista (mismo resultado que hará el servidor). */
export function applyLocalOps(items: ShoppingItemView[], ops: ShoppingOp[]): ShoppingItemView[] {
  let out = [...items];
  for (const op of [...ops].sort((a, b) => a.at - b.at)) {
    if (op.type === "check") out = out.map((i) => (i.id === op.id ? { ...i, checked: op.checked } : i));
    else if (op.type === "delete") out = out.filter((i) => i.id !== op.id);
    else if (!out.some((i) => i.id === op.id) && op.text.trim()) {
      out.push({ id: op.id, ...manualEntry(op.text), sources: [], cost: null, pantryNote: null, checked: false, manual: true });
    }
  }
  return out;
}

// Estado de conexión del navegador
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useShoppingSync(view: ShoppingView) {
  const week = view.weekStart;
  const router = useRouter();
  const [ops] = usePersistentState(opsKey(week), EMPTY_OPS, isOps);
  const [snap] = usePersistentState<Snapshot | null>(snapKey(week), null, isSnapshot);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const serverItems = view.list?.items ?? null;

  // Guardar copia local cuando llegan datos más nuevos del servidor
  useEffect(() => {
    if (serverItems && (!snap || view.renderedAt > snap.renderedAt)) {
      writePersistent(snapKey(week), { renderedAt: view.renderedAt, items: serverItems });
    }
  }, [serverItems, snap, view.renderedAt, week]);

  // Olvidar cambios ya enviados que los datos del servidor ya incluyen
  useEffect(() => {
    const keep = ops.filter((o) => !o.syncedAt || o.syncedAt > view.renderedAt);
    if (keep.length !== ops.length) writePersistent(opsKey(week), keep);
  }, [ops, view.renderedAt, week]);

  // Sin red, la página puede venir de una copia antigua: usar la más reciente
  const base = snap && snap.renderedAt > view.renderedAt ? snap.items : serverItems;
  const items = useMemo(() => (base ? applyLocalOps(base, ops) : null), [base, ops]);

  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    const pending = readPersistent(opsKey(week), EMPTY_OPS, isOps).filter((o) => !o.syncedAt);
    if (pending.length === 0) return;
    flushing.current = true;
    try {
      // Se envían sin la marca local de sincronización (todas están sin enviar).
      const { serverTime } = await syncShopping(week, pending);
      const sent = new Set(pending.map(opId));
      writePersistent(
        opsKey(week),
        readPersistent(opsKey(week), EMPTY_OPS, isOps).map((o) => (sent.has(opId(o)) ? { ...o, syncedAt: serverTime } : o)),
      );
      router.refresh();
    } catch {
      // Sin conexión: la cola se queda y se reintenta al volver la red
    } finally {
      flushing.current = false;
    }
  }, [week, router]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  const push = useCallback(
    (op: ShoppingOp) => {
      writePersistent(opsKey(week), [...readPersistent(opsKey(week), EMPTY_OPS, isOps), op]);
      setTimeout(flush, 250);
    },
    [week, flush],
  );

  return {
    items,
    online,
    pendingCount: ops.filter((o) => !o.syncedAt).length,
    toggle: (id: string, checked: boolean) => push({ type: "check", id, checked, at: Date.now() }),
    add: (text: string) => push({ type: "add", id: newId(), text, at: Date.now() }),
    remove: (id: string) => push({ type: "delete", id, at: Date.now() }),
  };
}
