"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";
import type { BrowseSort } from "@/lib/types";
import { BROWSE_SORTS } from "@/lib/browse-url";

interface Props {
  value: BrowseSort;
  /** href para cada opcao (calculado no servidor para manter os filtros). */
  hrefs: Record<BrowseSort, string>;
  /** Esconder "Relevância" quando nao ha termo de pesquisa. */
  hasQuery: boolean;
}

export function SortSelect({ value, hrefs, hasQuery }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = BROWSE_SORTS.filter((s) => hasQuery || s.value !== "relevance");

  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownUp className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">Ordenar</span>
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as BrowseSort;
          startTransition(() => router.push(hrefs[next]));
        }}
        className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        aria-label="Ordenar resultados"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
