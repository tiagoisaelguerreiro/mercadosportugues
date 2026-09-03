import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import type { SupermarketSummary } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupermarketAvatar } from "@/components/ui/SupermarketDot";
import { Badge } from "@/components/ui/Badge";

interface Props {
  summaries: SupermarketSummary[];
  /** Layout compacto para a home (menos colunas). */
  compact?: boolean;
  limit?: number;
  className?: string;
}

/** Ordena por quota de "mais barato" e, em empate, pelo indice de preco mais baixo. */
export function rankSupermarkets(summaries: SupermarketSummary[]): SupermarketSummary[] {
  return [...summaries]
    .filter((s) => s.offerCount > 0)
    .sort((a, b) => b.cheapestShare - a.cheapestShare || (a.priceIndex ?? 999) - (b.priceIndex ?? 999));
}

/**
 * Ranking de supermercados por "quota de mais barato" e indice de preco.
 * As barras sao relativas ao melhor da lista para leitura rapida.
 */
export function SupermarketRanking({ summaries, compact = false, limit, className }: Props) {
  const ranked = rankSupermarkets(summaries).slice(0, limit ?? summaries.length);
  if (ranked.length === 0) return null;
  const maxShare = Math.max(...ranked.map((s) => s.cheapestShare), 1);

  return (
    <ol className={cn("grid gap-3", className)}>
      {ranked.map((s, i) => {
        const leader = i === 0;
        return (
          <li key={s.supermarket.id}>
            <Link
              href={`/supermercado/${s.supermarket.slug}`}
              className={cn(
                "group grid items-center gap-4 rounded-3xl border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
                compact ? "grid-cols-[auto_1fr_auto]" : "grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto]",
                leader
                  ? "border-brand-300 bg-gradient-to-r from-brand-50/80 to-card dark:border-brand-800 dark:from-brand-950/30"
                  : "border-border hover:border-brand-300 dark:hover:border-brand-700",
              )}
            >
              <div className="relative">
                <SupermarketAvatar supermarket={s.supermarket} className="h-11 w-11" />
                <span
                  className={cn(
                    "absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ring-2 ring-card",
                    leader ? "bg-amber-400 text-amber-950" : "bg-foreground text-background",
                  )}
                >
                  {i + 1}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-extrabold tracking-tight text-foreground">{s.supermarket.name}</h3>
                  {leader && (
                    <Badge variant="amber">
                      <Trophy className="h-3 w-3" /> Mais vezes barato
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (s.cheapestShare / maxShare) * 100)}%`,
                        backgroundColor: s.supermarket.colorHex ?? "#64748b",
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-foreground tabular">
                    {s.cheapestShare.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  mais barato em {formatNumber(s.cheapestCount)} de {formatNumber(s.offerCount)} produtos
                  {s.promoCount > 0 && ` · ${formatNumber(s.promoCount)} em promoção`}
                </p>
              </div>

              {!compact && (
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Índice de preço</p>
                  <p
                    className={cn(
                      "font-display text-xl font-extrabold tabular",
                      s.priceIndex == null
                        ? "text-muted-foreground"
                        : s.priceIndex < 100
                          ? "text-brand-700 dark:text-brand-300"
                          : s.priceIndex > 100
                            ? "text-red-600 dark:text-red-400"
                            : "text-foreground",
                    )}
                  >
                    {s.priceIndex == null ? "—" : s.priceIndex.toFixed(1)}
                  </p>
                </div>
              )}

              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
