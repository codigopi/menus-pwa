"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Hoja inferior modal (action sheet) estilo iOS.
 * Se cierra tocando el fondo o con Escape.
 */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-black/35"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-[sheet-in_260ms_cubic-bezier(0.2,0.9,0.3,1)] px-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        {children}
      </div>
    </div>
  );
}
