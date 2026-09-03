"use client";

import { KeyRound, RefreshCw } from "lucide-react";

interface Props {
  token: string;
  onTokenChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  status?: string | null;
  submitLabel?: string;
}

export function AdminTokenBar({ token, onTokenChange, onSubmit, loading = false, status, submitLabel = "Carregar" }: Props) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <form
        className="flex flex-col gap-4 md:flex-row md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          <span className="mb-2 flex items-center gap-1.5 text-foreground">
            <KeyRound className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Token de administrador
          </span>
          <input
            type="password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="Valor de ADMIN_TOKEN no servidor"
            className="h-11 w-full rounded-2xl border border-border bg-muted/40 px-4 text-sm font-medium text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "A carregar…" : submitLabel}
        </button>
      </form>
      {status && <p className="mt-3 text-xs font-semibold text-muted-foreground">{status}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        O token fica apenas neste separador (sessionStorage) e é enviado no cabeçalho <code>Authorization</code>.
      </p>
    </section>
  );
}
