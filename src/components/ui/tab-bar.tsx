"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, CalendarDays, Ellipsis, ShoppingBasket, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/recetas", label: "Recetas", icon: BookOpen },
  { href: "/que-cocino", label: "¿Qué cocino?", icon: Sparkles },
  { href: "/menu", label: "Menú", icon: CalendarDays },
  { href: "/compra", label: "Compra", icon: ShoppingBasket },
  { href: "/mas", label: "Más", icon: Ellipsis },
];

/**
 * Barra de pestañas inferior translúcida, estilo iOS.
 * La URL solo se conoce en tiempo de petición, así que el shell estático
 * pinta la barra sin pestaña activa y la versión con URL llega en streaming.
 */
export function TabBar() {
  return (
    <Suspense fallback={<Bar pathname={null} />}>
      <ActiveBar />
    </Suspense>
  );
}

function ActiveBar() {
  return <Bar pathname={usePathname()} />;
}

function Bar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-bar pb-safe backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-[25px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
