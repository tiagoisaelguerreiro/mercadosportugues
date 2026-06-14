"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useBasket } from "@/lib/use-basket";
import { formatEuro } from "@/lib/format";
import type { BasketComparison, ProductWithOffers } from "@/lib/types";

export default function BasketPage() {
  const { items, setQuantity, remove, clear, totalCount } = useBasket();
  const [products, setProducts] = useState<Record<number, ProductWithOffers>>({});
  const [comparison, setComparison] = useState<BasketComparison | null>(null);
  const [loading, setLoading] = useState(false);

  // Carrega detalhes de cada produto para mostrar nome/imagem.
  useEffect(() => {
    const missing = items.filter((i) => !products[i.productGlobalId]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((i) =>
        fetch(`/api/products/${i.productGlobalId}`)
          .then((r) => (r.ok ? r.json() : null))
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
  }, [items, products]);

  const compare = useCallback(async () => {
    if (items.length === 0) {
      setComparison(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/basket/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setComparison(res.ok ? await res.json() : null);
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    compare();
  }, [compare]);

  if (totalCount === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">O teu carrinho está vazio</h1>
        <p className="mt-2 text-gray-500">
          Adiciona produtos e compara o custo total em cada supermercado.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Procurar produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Lista de itens */}
      <div className="lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">O teu carrinho ({totalCount})</h1>
          <button onClick={clear} className="text-sm text-gray-500 hover:text-red-600">
            Limpar
          </button>
        </div>
        <ul className="space-y-3">
          {items.map((item) => {
            const p = products[item.productGlobalId]?.product;
            return (
              <li
                key={item.productGlobalId}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p?.imageUrl ?? "https://placehold.co/64x64/png?text=P"}
                  alt={p?.nameGlobal ?? ""}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-lg bg-gray-50 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p?.nameGlobal ?? `Produto #${item.productGlobalId}`}
                  </p>
                  {p?.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setQuantity(item.productGlobalId, item.quantity - 1)}
                    className="h-7 w-7 rounded-full border border-gray-300 text-sm font-bold hover:bg-gray-100"
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => setQuantity(item.productGlobalId, item.quantity + 1)}
                    className="h-7 w-7 rounded-full border border-gray-300 text-sm font-bold hover:bg-gray-100"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => remove(item.productGlobalId)}
                  className="ml-1 text-gray-400 hover:text-red-600"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Comparacao */}
      <div className="lg:col-span-2">
        <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold">Comparação por supermercado</h2>
          {loading && <p className="mt-3 text-sm text-gray-500">A calcular…</p>}

          {comparison && (
            <>
              {comparison.winner && (
                <div className="mt-4 rounded-xl bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                    🏆 Mais barato
                    {comparison.winner.isComplete ? " (carrinho completo)" : " (parcial)"}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-brand-700">
                    {comparison.winner.supermarket.name} — {formatEuro(comparison.winner.total)}
                  </p>
                  {!comparison.winner.isComplete && (
                    <p className="mt-1 text-xs text-amber-700">
                      Faltam {comparison.winner.itemsMissing} item(s) neste supermercado.
                    </p>
                  )}
                </div>
              )}

              <ul className="mt-4 space-y-2">
                {comparison.results.map((r) => (
                  <li
                    key={r.supermarket.slug}
                    className={`flex items-center justify-between rounded-xl border p-3 ${
                      r.isWinner ? "border-brand-300 bg-brand-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: r.supermarket.colorHex ?? "#999" }}
                      />
                      <div>
                        <p className="text-sm font-semibold">{r.supermarket.name}</p>
                        <p className="text-xs text-gray-400">
                          {r.itemsAvailable} de {r.itemsAvailable + r.itemsMissing} itens
                          {r.itemsMissing > 0 && (
                            <span className="text-amber-600"> · {r.itemsMissing} em falta</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-base font-extrabold">{formatEuro(r.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-400">
                Os totais usam o preço efetivo (com promoção quando aplicável). Supermercados sem
                todos os itens aparecem marcados — a comparação só é totalmente justa entre
                carrinhos completos.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
