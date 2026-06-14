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
import { formatDatePt } from "@/lib/format";

interface Props {
  supermarkets: Supermarket[];
  points: HistoryPoint[];
}

export function PriceChart({ supermarkets, points }: Props) {
  if (points.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        Sem histórico de preços disponível.
      </p>
    );
  }

  const data = points.map((p) => ({ date: formatDatePt(p.date), ...p.prices }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(2)}€`}
            width={56}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value: number) => `${Number(value).toFixed(2)} €`}
            contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #eee" }}
          />
          {supermarkets.map((s) => (
            <Line
              key={s.slug}
              type="monotone"
              dataKey={s.slug}
              name={s.name}
              stroke={s.colorHex ?? "#888"}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3">
        {supermarkets.map((s) => (
          <span key={s.slug} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.colorHex ?? "#888" }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
