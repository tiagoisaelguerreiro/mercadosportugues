"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { HistoryPoint, PriceStats, Supermarket } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { HISTORY_PERIODS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PriceChart } from "./PriceChart";

export interface HistoryResponse {
  supermarkets: Supermarket[];
  points: HistoryPoint[];
  stats: PriceStats;
}

interface Props {
  productId: number;
  initial: HistoryResponse;
  initialDays: number;
  isDemo?: boolean;
}

/**
 * Historico de precos com seletor de periodo. Cada periodo e pedido a API uma
 * unica vez e fica em cache local; as estatisticas (min/max/media/variacao)
 * referem-se ao melhor preco diario entre todos os supermercados.
 */
export function InteractivePriceHistory({ productId, initial, initialDays, isDemo = false }: Props) {
  const [days, setDays] = useState(initialDays);
  const [cache, setCache] = useState<Record<number, HistoryResponse>>({ [initialDays]: initial });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = cache[days] ?? initial;

  useEffect(() => {
    if (cache[days]) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/products/${productId}/history?days=${days}`)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [days]: json }));
      })
      .catch(() => !cancelled && setError("Não foi possível carregar o histórico."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days, productId, cache]);

  const { stats } = data;

  return (
    <div className="rounded-4xl border border-border bg-card p-5 shadow-soft sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Evolução do preço</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma recolha por dia, promoções incluídas. Linhas em patamar: o preço só muda quando a loja altera a etiqueta.
            Clica numa cadeia para a ocultar; duplo clique para ver só essa.
          </p>
        </div>
        <div role="tablist" aria-label="Período do histórico" className="inline-flex rounded-2xl border border-border bg-muted/50 p-1">
          {HISTORY_PERIODS.map((p) => (
            <button
              key={p.days}
              role="tab"
              type="button"
              aria-selected={days === p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-bold transition sm:text-sm",
                days === p.days
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-500/20"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Mínimo" value={formatEuro(stats.min)} tone="brand" />
        <Stat label="Máximo" value={formatEuro(stats.max)} />
        <Stat label="Média" value={formatEuro(stats.avg)} />
        <Stat
          label={`Variação (${days} dias)`}
          value={
            stats.changePercent == null ? (
              "—"
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  stats.changePercent < 0
                    ? "text-brand-700 dark:text-brand-300"
                    : stats.changePercent > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-foreground",
                )}
              >
                {stats.changePercent < 0 ? (
                  <ArrowDownRight className="h-4 w-4" />
                ) : stats.changePercent > 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {stats.changePercent > 0 ? "+" : ""}
                {stats.changePercent.toFixed(1)}%
              </span>
            )
          }
          hint={stats.changeAbsolute != null ? `${stats.changeAbsolute > 0 ? "+" : ""}${formatEuro(stats.changeAbsolute)}` : undefined}
        />
      </dl>

      <div className="relative rounded-3xl bg-transparent" aria-busy={loading}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/50 backdrop-blur-sm">
            <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-sm">A carregar…</span>
          </div>
        )}
        {error ? (
          <p className="p-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <PriceChart supermarkets={data.supermarkets} points={data.points} />
        )}
      </div>
      {isDemo && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Modo demonstração: cada ponto é uma recolha diária simulada (o preço das lojas costuma
          manter-se vários dias). Com PostgreSQL e o scraper ativo, passam a ser preços reais
          capturados de manhã.
        </p>
      )}
      {!isDemo && data.points.length <= 2 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O histórico começa nesta recolha. Corre o scraper todos os dias para ver a evolução do
          preço (mínimo, máximo e variação).
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "brand";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        tone === "brand"
          ? "border-brand-200 bg-brand-50/70 dark:border-brand-900/50 dark:bg-brand-950/20"
          : "border-border bg-background/60",
      )}
    >
      <dt className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-display text-lg font-extrabold tabular sm:text-xl",
          tone === "brand" ? "text-brand-800 dark:text-brand-300" : "text-foreground",
        )}
      >
        {value}
      </dd>
      {hint && <dd className="text-[11px] text-muted-foreground tabular">{hint}</dd>}
    </div>
  );
}
