import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/access";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Acceso" };

export default function AccessPage({ searchParams }: PageProps<"/acceso">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 pt-safe pb-safe text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="mb-5 size-20 rounded-[22px] shadow-sm" />
      <h1 className="font-display text-[28px] font-bold tracking-tight">Cocina en Casa</h1>
      <p className="mt-1 mb-8 text-[15px] text-muted">Introduce el código de casa para entrar.</p>
      <Suspense fallback={<div className="h-28" />}>
        <FormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithNext({ searchParams }: { searchParams: PageProps<"/acceso">["searchParams"] }) {
  const { next } = await searchParams;
  return <AccessForm next={safeNextPath(typeof next === "string" ? next : null)} />;
}
