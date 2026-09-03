"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Minus,
  Plus,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { useBasket, type BasketItem } from "@/lib/use-basket";
import { BASKET_SHARE_PARAM, basketShareUrl, decodeBasket } from "@/lib/basket-share";
import { formatEuro } from "@/lib/format";
import type { BasketComparison, ProductWithOffers } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShareButton } from "@/components/ShareButton";
import { ProductImage } from "@/components/ProductImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { SupermarketDot } from "@/components/ui/SupermarketDot";

export function BasketView() {
  const { items, setQuantity, remove, clear, replaceAll, merge, totalCount, hydrated } = useBasket();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Record<number, ProductWithOffers>>({});
  const [comparison, setComparison] = useState<BasketComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Carrinho partilhado via URL (?itens=1x2,5) — pede confirmacao antes de alterar o carrinho local.
  const shared = useMemo(() => decodeBasket(searchParams.get(BASKET_SHARE_PARAM)), [searchParams]);
  const [sharedDismissed, setSharedDismissed] = useState(false);
  const showSharedBanner = hydrated && shared.length > 0 && !sharedDismissed;

  function finishImport() {
    setSharedDismissed(true);
    router.replace("/carrinho", { scroll: false });
  }

  // Carrega detalhes (nome/imagem/ofertas) dos produtos ainda desconhecidos.
  useEffect(() => {
    const wanted = new Set<number>([...items.map((i) => i.productGlobalId), ...shared.map((i) => i.productGlobalId)]);
    const missing = [...wanted].filter((id) => !products[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        fetch(`/api/products/${id}`)
          .then((r) => (r.ok ? (r.json() as Promise<ProductWithOffers>) : null))
          .catch(() => null),
      ),
    ).then((loaded) => {
      if (cancelled) return;
      setProducts((prev) => {
        const next = { ...prev };
        for (const p of loaded) if (p?.product) next[p.product.id] = p;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [items, shared, products]);

  const compare = useCallback(async () => {
    if (items.length === 0) {
      setComparison(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/basket/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setComparison((await res.json()) as BasketComparison);
    } catch {
      setError("Não foi possível calcular a comparação. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    void compare();
  }, [compare]);

  function copyShoppingList() {
    if (items.length === 0) return;
    const lines = items
      .map((item) => {
        const p = products[item.productGlobalId]?.product;
        const name = p?.nameGlobal ?? `Produto #${item.productGlobalId}`;
        return `- ${item.quantity}x ${name}${p?.brand ? ` (${p.brand})` : ""}`;
      })
      .join("\n");
    const winner = comparison?.winner
      ? `\n\nMais barato em: ${comparison.winner.supermarket.name} (${formatEuro(comparison.winner.total)})`
      : "";
    const text = `Lista de compras (MercadosPortugues)\n${lines}${winner}\n\n${basketShareUrl(window.location.origin, items)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const shareUrl = typeof window !== "undefined" ? basketShareUrl(window.location.origin, items) : undefined;

  // Poupanca: diferenca entre o carrinho completo mais caro e o vencedor.
  const savings = useMemo(() => {
    if (!comparison?.winner) return null;
    const complete = comparison.results.filter((r) => r.isComplete);
    if (complete.length < 2) return null;
    const priciest = Math.max(...complete.map((r) => r.total));
    const diff = priciest - comparison.winner.total;
    return diff > 0.004 ? { diff, percent: (diff / priciest) * 100 } : null;
  }, [comparison]);

  if (!hydrated) {
    return <div className="min-h-[40vh]" aria-busy />;
  }

  return (
    <div className="space-y-8">
      {showSharedBanner && (
        <SharedBasketBanner
          shared={shared}
          products={products}
          hasOwnItems={items.length > 0}
          onReplace={() => {
            replaceAll(shared);
            finishImport();
          }}
          onMerge={() => {
            merge(shared);
            finishImport();
          }}
          onDismiss={finishImport}
        />
      )}

      {totalCount === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="O teu carrinho está vazio"
          description="Adiciona produtos a partir do catálogo para descobrires imediatamente em que supermercado o cabaz completo fica mais barato."
          className="mx-auto max-w-2xl"
        >
          <Link
            href="/pesquisa"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500"
          >
            Explorar catálogo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/promocoes"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
          >
            Ver promoções
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
                  <Sparkles className="h-3.5 w-3.5" /> Comparador de carrinho
                </p>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  O teu carrinho{" "}
                  <span className="text-muted-foreground">
                    ({totalCount} {totalCount === 1 ? "item" : "itens"})
                  </span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajusta quantidades e vê o custo total em cada supermercado. O carrinho fica guardado neste dispositivo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ShareButton title="O meu carrinho — MercadosPortugues" url={shareUrl} label="Partilhar carrinho" />
                <button
                  type="button"
                  onClick={copyShoppingList}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                      <span className="text-brand-600 dark:text-brand-400">Lista copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar lista
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground shadow-sm transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Limpar
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Produtos</h2>
                <Link href="/pesquisa" className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400">
                  + Adicionar mais
                </Link>
              </div>
              <ul className="space-y-3">
                {items.map((item) => {
                  const data = products[item.productGlobalId];
                  const p = data?.product;
                  const cheapest = data?.offers[0] ?? null;
                  return (
                    <li
                      key={item.productGlobalId}
                      className="group flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:border-brand-300 sm:flex-row sm:items-center sm:p-5 dark:hover:border-brand-800/60"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <Link
                          href={`/produto/${item.productGlobalId}`}
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
                        >
                          <ProductImage
                            src={p?.imageUrl}
                            alt=""
                            name={p?.nameGlobal}
                            brand={p?.brand}
                            className="h-14 w-14 rounded-xl"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          {p?.brand && <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{p.brand}</p>}
                          <Link
                            href={`/produto/${item.productGlobalId}`}
                            className="block truncate text-sm font-extrabold text-foreground hover:text-brand-700 dark:hover:text-brand-300"
                          >
                            {p?.nameGlobal ?? (data === undefined ? "A carregar…" : `Produto #${item.productGlobalId}`)}
                          </Link>
                          {cheapest && (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              desde <span className="font-extrabold text-brand-700 tabular dark:text-brand-300">{formatEuro(cheapest.effectivePrice)}</span>
                              <SupermarketDot supermarket={cheapest.supermarket} size="sm" /> {cheapest.supermarket.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                        <div className="flex items-center rounded-2xl border border-border bg-muted/40 p-1" role="group" aria-label="Quantidade">
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productGlobalId, item.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/70 transition hover:bg-card hover:text-foreground active:scale-95"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-black text-foreground tabular" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productGlobalId, Math.min(99, item.quantity + 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/70 transition hover:bg-card hover:text-foreground active:scale-95"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(item.productGlobalId)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500"
                          aria-label="Remover produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-24 rounded-4xl border border-border bg-card p-6 shadow-lift">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Total por supermercado</h2>
                  {loading && <span className="animate-pulse text-xs font-semibold text-muted-foreground">A calcular…</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Preços em vigor hoje. Produtos em falta não entram no total.</p>

                {error && (
                  <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                    {error}{" "}
                    <button type="button" onClick={() => void compare()} className="underline">
                      Repetir
                    </button>
                  </p>
                )}

                {comparison && (
                  <div className="mt-6 space-y-4">
                    {comparison.winner && (
                      <div className="relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50/80 p-5 dark:border-brand-900/50 dark:bg-brand-950/20">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Badge variant="brand">
                              <Trophy className="h-3 w-3" /> Mais barato
                            </Badge>
                            <h3 className="mt-2 flex items-center gap-2 font-display text-xl font-extrabold text-foreground">
                              <SupermarketDot supermarket={comparison.winner.supermarket} size="lg" />
                              {comparison.winner.supermarket.name}
                            </h3>
                            <p className="mt-0.5 text-xs font-semibold text-brand-700 dark:text-brand-400">
                              {comparison.winner.isComplete
                                ? "Tem todos os produtos do carrinho"
                                : `Faltam ${comparison.winner.itemsMissing} produto${comparison.winner.itemsMissing === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <p className="shrink-0 font-display text-3xl font-extrabold tracking-tight text-brand-700 tabular dark:text-brand-300">
                            {formatEuro(comparison.winner.total)}
                          </p>
                        </div>
                        {savings && (
                          <p className="mt-3 border-t border-brand-200/70 pt-3 text-xs font-semibold text-brand-800 dark:border-brand-900/50 dark:text-brand-300">
                            Poupas até <span className="font-black tabular">{formatEuro(savings.diff)}</span> ({savings.percent.toFixed(0)}%) face ao
                            supermercado completo mais caro.
                          </p>
                        )}
                      </div>
                    )}

                    {comparison.bestCompleteResult &&
                      comparison.winner &&
                      comparison.bestCompleteResult.supermarket.slug !== comparison.winner.supermarket.slug && (
                        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs">
                          <p className="font-bold text-foreground">Alternativa com carrinho completo</p>
                          <p className="mt-1 text-muted-foreground">
                            No <strong className="text-foreground">{comparison.bestCompleteResult.supermarket.name}</strong> tens todos os
                            produtos por <span className="font-black text-foreground tabular">{formatEuro(comparison.bestCompleteResult.total)}</span>.
                          </p>
                        </div>
                      )}

                    <div className="space-y-2.5 pt-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Todos os supermercados</p>
                      {comparison.results.map((r) => {
                        const expanded = expandedMarket === r.supermarket.slug;
                        const totalItems = r.itemsAvailable + r.itemsMissing;
                        return (
                          <div
                            key={r.supermarket.slug}
                            className={cn(
                              "rounded-2xl border transition",
                              r.isWinner ? "border-brand-300 bg-brand-50/30 dark:border-brand-800 dark:bg-brand-950/10" : "border-border bg-card",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedMarket(expanded ? null : r.supermarket.slug)}
                              aria-expanded={expanded}
                              className="flex w-full items-center justify-between gap-3 p-4 text-left"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <SupermarketDot supermarket={r.supermarket} size="lg" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-extrabold text-foreground">{r.supermarket.name}</span>
                                    {r.isWinner && <Badge variant="brand">Vencedor</Badge>}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                      <span
                                        className="block h-full rounded-full bg-brand-500"
                                        style={{ width: `${totalItems ? (r.itemsAvailable / totalItems) * 100 : 0}%` }}
                                      />
                                    </span>
                                    <span className="text-[11px] font-medium text-muted-foreground tabular">
                                      {r.itemsAvailable}/{totalItems} produtos
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <div className="text-right">
                                  <span className="font-display text-base font-extrabold text-foreground tabular">{formatEuro(r.total)}</span>
                                  {r.itemsMissing > 0 && (
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{r.itemsMissing} em falta</p>
                                  )}
                                </div>
                                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </button>
                            {expanded && (
                              <ul className="space-y-1.5 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs">
                                {r.lines.map((l) => (
                                  <li key={l.productGlobalId} className="flex items-center justify-between gap-2">
                                    <span className="truncate text-foreground/90">
                                      <span className="tabular">{l.quantity}x</span> {l.productName}
                                    </span>
                                    {l.available ? (
                                      <span className="shrink-0 font-bold text-foreground tabular">
                                        {formatEuro(l.lineTotal)}
                                        {l.quantity > 1 && <span className="ml-1 text-[10px] font-normal text-muted-foreground">({formatEuro(l.unitPrice)}/un)</span>}
                                      </span>
                                    ) : (
                                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-3 w-3" /> Indisponível
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SharedBasketBanner({
  shared,
  products,
  hasOwnItems,
  onReplace,
  onMerge,
  onDismiss,
}: {
  shared: BasketItem[];
  products: Record<number, ProductWithOffers>;
  hasOwnItems: boolean;
  onReplace: () => void;
  onMerge: () => void;
  onDismiss: () => void;
}) {
  const count = shared.reduce((s, i) => s + i.quantity, 0);
  const names = shared
    .map((i) => products[i.productGlobalId]?.product.nameGlobal)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  return (
    <section
      role="region"
      aria-label="Carrinho partilhado"
      className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-soft dark:border-sky-900/50 dark:bg-sky-950/20 animate-fade-up"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white">
            <Download className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-foreground">
              Recebeste um carrinho partilhado com {count} {count === 1 ? "item" : "itens"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {names.length > 0 ? `${names.join(", ")}${shared.length > names.length ? "…" : ""}` : "A carregar produtos…"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={hasOwnItems ? onMerge : onReplace}
            className="inline-flex h-9 items-center rounded-xl bg-sky-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500"
          >
            {hasOwnItems ? "Juntar ao meu carrinho" : "Usar este carrinho"}
          </button>
          {hasOwnItems && (
            <button
              type="button"
              onClick={onReplace}
              className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground transition hover:bg-muted"
            >
              Substituir o meu
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-bold text-muted-foreground transition hover:text-foreground"
          >
            Ignorar
          </button>
        </div>
      </div>
    </section>
  );
}
