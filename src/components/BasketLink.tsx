"use client";

import Link from "next/link";
import { useBasket } from "@/lib/use-basket";

/** Link do carrinho no header com contador de itens (lido do localStorage). */
export function BasketLink() {
  const { totalCount } = useBasket();
  return (
    <Link href="/carrinho" className="relative flex items-center gap-1.5 hover:text-brand-600">
      <span aria-hidden>🛒</span>
      <span>Carrinho</span>
      {totalCount > 0 && (
        <span
          className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white"
          aria-label={`${totalCount} itens no carrinho`}
        >
          {totalCount}
        </span>
      )}
    </Link>
  );
}
