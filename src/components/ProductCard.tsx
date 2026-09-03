"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ProductWithOffers } from "@/lib/types";
import { formatEuro, formatPricePerUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToBasketButton } from "./AddToBasketButton";
import { ProductImage } from "./ProductImage";
import { Badge } from "./ui/Badge";
import { SupermarketDot } from "./ui/SupermarketDot";

const MAX_VISIBLE_OFFERS = 4;

export function ProductCard({ data }: { data: ProductWithOffers }) {
  const { product, offers, savingsAbsolute, savingsPercent, cheapestPrice } = data;
  const cheapest = offers[0] ?? null;
  const visibleOffers = offers.slice(0, MAX_VISIBLE_OFFERS);
  const href = `/produto/${product.id}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group flex min-h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift dark:hover:border-brand-700/60"
    >
      <div className="flex gap-4 p-5">
        <Link
          href={href}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
          aria-hidden
          tabIndex={-1}
        >
          <ProductImage
            src={product.imageUrl}
            alt=""
            name={product.nameGlobal}
            brand={product.brand}
            className="h-20 w-20 rounded-2xl ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {product.brand && (
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{product.brand}</p>
              )}
              <h3 className="mt-1 line-clamp-2 text-sm font-extrabold leading-snug text-foreground">
                <Link href={href} className="transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
                  {product.nameGlobal}
                </Link>
              </h3>
            </div>
            {savingsPercent != null && savingsPercent > 0 && offers.length > 1 && (
              <Badge variant="amber" className="shrink-0 px-2 py-1 text-[11px]">
                -{savingsPercent.toFixed(0)}%
              </Badge>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">desde</p>
              <p className="font-display text-2xl font-extrabold tracking-tight text-brand-700 tabular dark:text-brand-300">
                {formatEuro(cheapestPrice)}
              </p>
            </div>
            <AddToBasketButton productGlobalId={product.id} />
          </div>
          {cheapest && (
            <p className="mt-2 truncate text-[11px] font-semibold text-muted-foreground">
              Melhor no {cheapest.supermarket.name}
              {savingsAbsolute != null && savingsAbsolute > 0 ? ` · poupa até ${formatEuro(savingsAbsolute)}` : ""}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-auto divide-y divide-border/50 border-t border-border/60 bg-muted/30">
        {visibleOffers.map((offer) => {
          const ppu = formatPricePerUnit(offer.pricePerUnit, offer.pricePerUnitUom);
          return (
            <li
              key={offer.productMarketId}
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors",
                offer.isCheapest ? "bg-brand-50/60 dark:bg-brand-900/10" : "hover:bg-muted/50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <SupermarketDot supermarket={offer.supermarket} />
                <span className="truncate font-semibold text-foreground/90">{offer.supermarket.name}</span>
                {offer.isCheapest && <Badge variant="brand">Melhor</Badge>}
                {offer.hasPromo && <Badge variant="promo">Promo</Badge>}
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-2">
                  {offer.hasPromo && (
                    <span className="text-[11px] text-muted-foreground line-through tabular">{formatEuro(offer.priceRegular)}</span>
                  )}
                  <span className={cn("text-sm font-extrabold tabular", offer.isCheapest ? "text-brand-700 dark:text-brand-300" : "text-foreground")}>
                    {formatEuro(offer.effectivePrice)}
                  </span>
                </div>
                {ppu && <p className="text-[10px] text-muted-foreground tabular">{ppu}</p>}
              </div>
            </li>
          );
        })}
        {offers.length > visibleOffers.length && (
          <li>
            <Link href={href} className="block bg-muted/20 px-5 py-2 text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
              +{offers.length - visibleOffers.length} supermercado{offers.length - visibleOffers.length === 1 ? "" : "s"}
            </Link>
          </li>
        )}
      </ul>
    </motion.article>
  );
}
