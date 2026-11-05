"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { enter, type AccessState } from "./actions";

export function AccessForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(enter, { error: null });
  return (
    <form action={action} className="w-full space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="code"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Código de acceso"
        aria-label="Código de acceso"
        aria-invalid={Boolean(state.error)}
        className="h-12 w-full rounded-xl bg-card px-4 text-center text-[17px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent/40"
      />
      {state.error && <p role="alert" className="text-center text-[15px] text-danger">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Comprobando…" : "Entrar"}
      </Button>
    </form>
  );
}
