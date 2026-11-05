"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** Textarea que crece con su contenido (sin barras de scroll internas). */
export function AutoTextarea({ value, className, ...props }: ComponentProps<"textarea"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} className={className} {...props} />;
}
