"use client";

import { useEffect, useState } from "react";
import type { HistoryPoint, Supermarket } from "@/lib/types";
import { PriceChart } from "./PriceChart";

interface HistoryResponse {
  supermarkets: Supermarket[];
  points: HistoryPoint[];
}

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "1 ano", days: 365 },
] as const;

interface Props {
  productId: number;
  initial: HistoryResponse;
  initialDays: number;
}

/**
 * Secção interativa do histórico de preços: permite alternar entre
 * 7d / 30d / 90d / 1 ano, buscando os dados à API por período.
 */
export function InteractivePriceHistory({ productId, initial, initialDays }: Props) {
  const [days, setDays] = useState(initialDays);
  const [data, setData] = useState<HistoryResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState<Record<number, HistoryResponse>>({
    [initialDays]: initial,
  });

  useEffect(() => {
    if (cache[days]) {
      setData(cache[days]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/products/${productId}/history?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: HistoryResponse | null) => {
        if (cancelled || !json) return;
        setData(json);
        setCache((prev) => ({ ...prev, [days]: json }));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days, productId, cache]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Evolução do preço</h2>
        <div
          role="tablist"
          aria-label="Período do histórico"
          className="inline-flex rounded-full border border-gray-200 bg-white p-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p.days}
              role="tab"
              aria-selected={days === p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                days === p.days
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative rounded-2xl border border-gray-200 bg-white p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60">
            <span className="text-sm text-gray-500">A carregar…</span>
          </div>
        )}
        <PriceChart supermarkets={data.supermarkets} points={data.points} />
      </div>
    </div>
  );
}
