"use client";

import { useBasket } from "@/lib/use-basket";

export function AddToBasketButton({ productGlobalId }: { productGlobalId: number }) {
  const { has, add, remove } = useBasket();
  const inBasket = has(productGlobalId);

  return (
    <button
      type="button"
      onClick={() => (inBasket ? remove(productGlobalId) : add(productGlobalId))}
      aria-pressed={inBasket}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        inBasket
          ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
          : "bg-brand-600 text-white hover:bg-brand-700"
      }`}
    >
      {inBasket ? "✓ No carrinho" : "+ Adicionar"}
    </button>
  );
}
