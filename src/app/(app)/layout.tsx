import { TabBar } from "@/components/ui/tab-bar";

/** Estructura común de la app: contenido centrado + barra de pestañas inferior. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">{children}</main>
      <TabBar />
    </>
  );
}
