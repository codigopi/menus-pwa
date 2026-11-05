import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">{icon}</div>
      <h2 className="mb-1.5 text-[20px] font-semibold">{title}</h2>
      {children && <p className="mb-6 max-w-xs text-[15px] leading-snug text-muted">{children}</p>}
      {action}
    </div>
  );
}
