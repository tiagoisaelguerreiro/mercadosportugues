"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint, Supermarket } from "@/lib/types";
import { formatDateLong, formatDatePt, formatEuro } from "@/lib/format";
import { chartColor } from "@/lib/chart-colors";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  supermarkets: Supermarket[];
  points: HistoryPoint[];
}

type ChartRow = { iso: string } & Record<string, number | string | null>;

export function PriceChart({ supermarkets, points }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  const data = useMemo<ChartRow[]>(
    () => points.map((p) => ({ iso: p.date, ...p.prices })),
    [points],
  );

  const visible = useMemo(
    () => supermarkets.filter((s) => !hidden.has(s.slug)),
    [supermarkets, hidden],
  );

  const last = points[points.length - 1];

  const yDomain = useMemo<[number, number]>(() => {
    const values: number[] = [];
    for (const row of points) {
      for (const s of visible) {
        const v = row.prices[s.slug];
        if (typeof v === "number") values.push(v);
      }
    }
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.04, (max - min) * 0.14);
    return [Math.max(0, min - pad), max + pad];
  }, [points, visible]);

  if (points.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem histórico de preços disponível.
      </p>
    );
  }

  const isDark = mounted && resolvedTheme === "dark";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#334155" : "#cbd5e1";
  const textColor = isDark ? "#94a3b8" : "#64748b";

  const toggle = (slug: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      if (next.size === supermarkets.length) return new Set();
      return next;
    });
  };

  const isolate = (slug: string) => {
    setHidden(new Set(supermarkets.filter((s) => s.slug !== slug).map((s) => s.slug)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {supermarkets.map((s) => {
          const isHidden = hidden.has(s.slug);
          const color = chartColor(s);
          const price = last?.prices[s.slug];
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => toggle(s.slug)}
              onDoubleClick={(e) => {
                e.preventDefault();
                isolate(s.slug);
              }}
              aria-pressed={!isHidden}
              title={`${isHidden ? "Mostrar" : "Ocultar"} ${s.name}. Duplo clique para ver só esta cadeia.`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left transition",
                isHidden
                  ? "border-dashed border-border bg-transparent text-muted-foreground opacity-55"
                  : "border-border bg-card text-foreground shadow-sm",
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-bold uppercase tracking-wider">{s.name}</span>
              {typeof price === "number" && (
                <span className="text-[11px] font-extrabold tabular">{formatEuro(price)}</span>
              )}
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={() => setHidden(new Set())}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold text-brand-700 hover:underline dark:text-brand-300"
          >
            Mostrar todas
          </button>
        )}
      </div>

      <div className="h-[320px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 8" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="iso"
              tickFormatter={formatDatePt}
              tick={{ fontSize: 11, fill: textColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={false}
              minTickGap={36}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: textColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Number(v).toFixed(2)} €`}
              width={58}
              domain={yDomain}
              dx={-4}
            />
            <Tooltip
              cursor={{ stroke: isDark ? "#475569" : "#94a3b8", strokeDasharray: "3 3" }}
              content={<PriceTooltip supermarkets={visible} isDark={isDark} />}
            />
            {visible.map((s) => (
              <Line
                key={s.slug}
                type="stepAfter"
                dataKey={s.slug}
                name={s.name}
                stroke={chartColor(s)}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: chartColor(s) }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
  label,
  supermarkets,
  isDark,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string }[];
  label?: string;
  supermarkets: Supermarket[];
  isDark: boolean;
}) {
  if (!active || !payload?.length || !label) return null;
  const bySlug = new Map(payload.map((item) => [String(item.dataKey), item.value]));
  const rows = supermarkets
    .map((s) => {
      const value = bySlug.get(s.slug);
      return typeof value === "number" ? { supermarket: s, value } : null;
    })
    .filter((row): row is { supermarket: Supermarket; value: number } => row != null)
    .sort((a, b) => a.value - b.value);
  if (rows.length === 0) return null;
  const best = rows[0].value;

  return (
    <div
      className="min-w-48 rounded-2xl border border-border px-3.5 py-3 shadow-lift"
      style={{ backgroundColor: isDark ? "#0f172a" : "#ffffff" }}
    >
      <p className="text-xs font-bold text-foreground">{formatDateLong(label)}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map(({ supermarket, value }) => {
          const isBest = value === best;
          return (
            <li key={supermarket.slug} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColor(supermarket) }} />
                <span className={cn("truncate", isBest ? "font-extrabold text-foreground" : "font-medium text-muted-foreground")}>
                  {supermarket.name}
                </span>
              </span>
              <span className={cn("shrink-0 tabular", isBest ? "font-extrabold text-brand-700 dark:text-brand-300" : "font-semibold text-foreground")}>
                {formatEuro(value)}
                {isBest ? " · melhor" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
