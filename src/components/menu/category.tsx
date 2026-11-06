import { CATEGORY_LABELS, type Category } from "@/lib/domain/menu";
import { cn } from "@/components/ui/cn";

/** Colores por tipo de plato (suaves, legibles en claro y oscuro). */
export const CATEGORY_COLORS: Record<Category, string> = {
  legumbre: "bg-[#a0763c]",
  pescado: "bg-[#4f86b7]",
  carne: "bg-[#c0673e]",
  huevo: "bg-[#e0b23a]",
  pasta_arroz: "bg-[#d39a5a]",
  verdura: "bg-[#6f9a72]",
};

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", CATEGORY_COLORS[category], className)} />;
}

export function CategoryLabel({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CategoryDot category={category} />
      {CATEGORY_LABELS[category]}
    </span>
  );
}
