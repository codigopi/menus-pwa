"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CookSheet } from "./cook-sheet";

/** Botón "Lo he cocinado" de la ficha de receta. */
export function CookedButton({ recipe }: { recipe: { id: string; title: string } }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <ChefHat className="size-5" /> {saved ? "¡Apuntado! ¿Otra vez?" : "Lo he cocinado"}
      </Button>
      {open && <CookSheet recipe={recipe} onClose={() => setOpen(false)} onDone={() => setSaved(true)} />}
    </>
  );
}
