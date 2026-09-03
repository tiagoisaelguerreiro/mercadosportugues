"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { useBasket } from "@/lib/use-basket";
import { cn } from "@/lib/utils";

/** Link do carrinho no header com contador de itens (lido do localStorage). */
export function BasketLink() {
  const { totalCount } = useBasket();
  const pathname = usePathname();
  const active = pathname === "/carrinho";

  return (
    <Link
      href="/carrinho"
      aria-label={totalCount > 0 ? `Carrinho, ${totalCount} itens` : "Carrinho"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-sm transition-colors",
        active
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
          : "border-border bg-card text-foreground/80 hover:border-brand-300 hover:text-brand-700 dark:hover:border-brand-700 dark:hover:text-brand-300",
      )}
    >
      <ShoppingBasket className="h-[18px] w-[18px]" />
      <span className="hidden sm:inline">Carrinho</span>
      {totalCount > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white tabular">
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      )}
    </Link>
  );
}
