"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "./cn";

/**
 * Cabecera estilo iOS: barra superior translúcida fija + título grande.
 * Al hacer scroll y desaparecer el título grande, aparece el título pequeño
 * centrado en la barra (como en las apps nativas).
 */
export function PageHeader({
  title,
  back,
  actions,
  large = true,
  subtitle,
}: {
  title: string;
  /** Botón de volver: enlace (href) o acción (onClick, tiene prioridad). */
  back?: { href: string; label: string; onClick?: () => void };
  actions?: ReactNode;
  large?: boolean;
  subtitle?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(!large);

  useEffect(() => {
    if (!large || !sentinel.current) return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      rootMargin: "-52px 0px 0px 0px",
    });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [large]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 -mx-4 px-2 pt-safe backdrop-blur-xl backdrop-saturate-150 transition-colors",
          compact ? "border-b border-hairline bg-bar" : "border-b border-transparent bg-canvas/0",
        )}
      >
        <div className="relative flex h-11 items-center justify-between">
          <div className="z-10 flex min-w-0 items-center">
            {back &&
              (back.onClick ? (
                <button type="button" onClick={back.onClick} className="tap flex items-center text-[17px] text-accent">
                  <ChevronLeft className="size-7 -mr-0.5" strokeWidth={2.2} />
                  <span className="max-w-[9rem] truncate">{back.label}</span>
                </button>
              ) : (
                <Link href={back.href} className="tap flex items-center text-[17px] text-accent">
                  <ChevronLeft className="size-7 -mr-0.5" strokeWidth={2.2} />
                  <span className="max-w-[9rem] truncate">{back.label}</span>
                </Link>
              ))}
          </div>
          <h1
            aria-hidden={large}
            className={cn(
              "pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold transition-opacity duration-200",
              compact ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </h1>
          <div className="z-10 flex items-center gap-1 pr-2">{actions}</div>
        </div>
      </header>
      {large && (
        <div ref={sentinel} className="pt-1 pb-3">
          <h1 className="font-display text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-[15px] text-muted">{subtitle}</div>}
        </div>
      )}
    </>
  );
}
