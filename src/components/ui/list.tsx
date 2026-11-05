import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

/** Grupo de filas "inset grouped" como en Ajustes de iOS. */
export function ListGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-7", className)}>
      {header && (
        <h2 className="px-4 pb-1.5 text-[13px] font-medium uppercase tracking-wide text-muted">{header}</h2>
      )}
      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] text-muted">{footer}</p>}
    </section>
  );
}

/** Fila de lista; si recibe href se comporta como enlace con chevron. */
export function ListRow({
  icon,
  title,
  detail,
  href,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {icon && <span className="grid size-7 shrink-0 place-items-center rounded-lg">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-[17px]">{title}</span>
      {detail && <span className="shrink-0 text-[15px] text-muted">{detail}</span>}
      {href && <ChevronRight className="size-4 shrink-0 text-muted/60" />}
    </>
  );
  const base = cn("flex min-h-12 items-center gap-3 px-4 py-2.5", className);
  return href ? (
    <Link href={href} className={cn(base, "transition-colors active:bg-fill")}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
