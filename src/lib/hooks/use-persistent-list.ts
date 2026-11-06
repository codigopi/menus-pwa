"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Estado JSON guardado en localStorage (solo en este dispositivo).
 * Usa useSyncExternalStore: el servidor pinta el valor por defecto y el
 * navegador el guardado, sin errores de hidratación.
 *
 * IMPORTANTE: `fallback` debe ser una referencia estable (constante de módulo).
 */
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  if (!cache.has(key)) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      cache.set(key, parsed !== null && validate(parsed) ? parsed : fallback);
    } catch {
      cache.set(key, fallback); // modo privado / almacenamiento bloqueado
    }
  }
  return cache.get(key) as T;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Escribe un valor (también usable fuera de componentes). */
export function writePersistent(key: string, value: unknown) {
  cache.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento: se mantiene solo en memoria
  }
  listeners.forEach((l) => l());
}

/** Lee el valor actual (fuera del render, p. ej. al sincronizar). */
export function readPersistent<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  return read(key, fallback, validate);
}

export function usePersistentState<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback, validate),
    () => fallback,
  );
  const setValue = useCallback((next: T) => writePersistent(key, next), [key]);
  return [value, setValue] as const;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Lista de textos persistente (lo que tengo, básicos…). */
export function usePersistentList(key: string, fallback: string[]) {
  return usePersistentState(key, fallback, isStringArray);
}
