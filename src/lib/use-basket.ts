"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mp_basket_v1";

export interface BasketItem {
  productGlobalId: number;
  quantity: number;
}

function read(): BasketItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: BasketItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("mp-basket-change"));
}

/** Hook de carrinho persistido em localStorage e sincronizado entre componentes. */
export function useBasket() {
  const [items, setItems] = useState<BasketItem[]>([]);
  // false ate ler o localStorage no cliente: evita mostrar "carrinho vazio" antes da hidratacao.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(read());
    setHydrated(true);
    const sync = () => setItems(read());
    window.addEventListener("mp-basket-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mp-basket-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((productGlobalId: number, quantity = 1) => {
    const current = read();
    const existing = current.find((i) => i.productGlobalId === productGlobalId);
    const next = existing
      ? current.map((i) =>
          i.productGlobalId === productGlobalId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        )
      : [...current, { productGlobalId, quantity }];
    write(next);
  }, []);

  const setQuantity = useCallback((productGlobalId: number, quantity: number) => {
    const current = read();
    const next =
      quantity <= 0
        ? current.filter((i) => i.productGlobalId !== productGlobalId)
        : current.map((i) =>
            i.productGlobalId === productGlobalId ? { ...i, quantity } : i,
          );
    write(next);
  }, []);

  const remove = useCallback((productGlobalId: number) => {
    write(read().filter((i) => i.productGlobalId !== productGlobalId));
  }, []);

  const clear = useCallback(() => write([]), []);

  /** Substitui o carrinho inteiro (ex.: importar carrinho partilhado). */
  const replaceAll = useCallback((next: BasketItem[]) => {
    write(next.filter((i) => i.quantity > 0));
  }, []);

  /** Junta linhas ao carrinho atual, somando quantidades de produtos repetidos. */
  const merge = useCallback((incoming: BasketItem[]) => {
    const current = read();
    const byId = new Map(current.map((i) => [i.productGlobalId, i.quantity]));
    for (const i of incoming) {
      if (i.quantity <= 0) continue;
      byId.set(i.productGlobalId, (byId.get(i.productGlobalId) ?? 0) + i.quantity);
    }
    write([...byId.entries()].map(([productGlobalId, quantity]) => ({ productGlobalId, quantity })));
  }, []);

  const has = useCallback(
    (productGlobalId: number) => items.some((i) => i.productGlobalId === productGlobalId),
    [items],
  );

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, add, setQuantity, remove, clear, replaceAll, merge, has, totalCount, hydrated };
}
