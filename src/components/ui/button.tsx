import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "plain" | "destructive";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-sm",
  secondary: "bg-accent-soft text-accent",
  plain: "text-accent",
  destructive: "bg-danger/10 text-danger",
};
const SIZES: Record<Size, string> = {
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-6 text-[17px] w-full",
};

/** Clases de botón reutilizables (también para <Link>). */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "tap inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
