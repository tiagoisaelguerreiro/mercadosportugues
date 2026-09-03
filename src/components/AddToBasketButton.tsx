"use client";

import { useBasket } from "@/lib/use-basket";
import { Check, Plus } from "lucide-react";

export function AddToBasketButton({ productGlobalId }: { productGlobalId: number }) {
  const { has, add, remove } = useBasket();
  const inBasket = has(productGlobalId);

  return (
    <button
      type="button"
      onClick={() => (inBasket ? remove(productGlobalId) : add(productGlobalId))}
      aria-pressed={inBasket}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
        inBasket
          ? "border border-brand-300 dark:border-brand-800 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 shadow-sm"
          : "bg-foreground text-background hover:opacity-90 shadow-sm"
      }`}
    >
      {inBasket ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
          <span>No carrinho</span>
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" />
          <span>Adicionar</span>
        </>
      )}
    </button>
  );
}
