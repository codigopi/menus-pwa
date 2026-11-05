import type { Metadata } from "next";
import { ShoppingBasket } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata: Metadata = { title: "Lista de la compra" };

export default function Page() {
  return (
    <ComingSoon title="Compra" icon={<ShoppingBasket className="size-8" />} phase={5}>
      La lista se generará sola desde el menú, agrupada por secciones del súper y restando lo que ya tienes.
    </ComingSoon>
  );
}
