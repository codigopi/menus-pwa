import { CookingPot } from "lucide-react";
import { photoUrl } from "@/lib/photo-url";
import { cn } from "@/components/ui/cn";

/** Fondos cálidos para recetas sin foto (se elige uno estable por título). */
const PLACEHOLDERS = [
  "from-[#e9dcc4] to-[#d9c4a2] text-[#8a6d43]",
  "from-[#dfe8da] to-[#c4d6bf] text-[#55705a]",
  "from-[#f3dccf] to-[#e6bfa8] text-[#a2593a]",
  "from-[#e8e0d0] to-[#d4c9b4] text-[#7a6b52]",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Foto de receta o, si no hay, un marcador de posición bonito. */
export function RecipePhoto({
  photo,
  title,
  className,
  priority = false,
}: {
  photo: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  if (photo) {
    return (
      // Las fotos ya llegan comprimidas y se cachean en el SW; <img> nativo es suficiente.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl(photo)}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("grid place-items-center bg-gradient-to-br", PLACEHOLDERS[hash(title) % PLACEHOLDERS.length], className)}
    >
      <CookingPot className="size-1/3 max-h-16 max-w-16 opacity-60" strokeWidth={1.5} />
    </div>
  );
}
