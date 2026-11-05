"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lista de textos guardada en localStorage (solo en este dispositivo).
 * Usa useSyncExternalStore: el servidor pinta el valor por defecto y el
 * navegador el guardado, sin errores de hidratación.
 *
 * IMPORTANTE: `fallback` debe ser una referencia estable (constante de módulo).
 */
const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();

function read(key: string, fallback: string[]): string[] {
  if (!cache.has(key)) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      cache.set(key, Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : fallback);
    } catch {
      cache.set(key, fallback); // modo privado / almacenamiento bloqueado
    }
  }
  return cache.get(key)!;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePersistentList(key: string, fallback: string[]) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const setValue = useCallback(
    (next: string[]) => {
      cache.set(key, next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // sin almacenamiento: se mantiene solo en memoria
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, setValue] as const;
}
