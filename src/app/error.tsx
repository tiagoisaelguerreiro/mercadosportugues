"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] erro nao tratado", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Algo correu mal</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Não conseguimos carregar esta página
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Pode ser um problema temporário de ligação à base de dados. Tenta novamente; se persistir, volta mais tarde.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">ref. {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500"
        >
          <RotateCcw className="h-4 w-4" /> Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
