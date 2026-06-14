import Link from "next/link";
import type { ProductWithOffers } from "@/lib/types";
import { formatEuro, formatPricePerUnit } from "@/lib/format";
import { AddToBasketButton } from "./AddToBasketButton";

export function ProductCard({ data }: { data: ProductWithOffers }) {
  const { product, offers, savingsPercent } = data;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl ?? "https://placehold.co/120x120/png?text=Produto"}
          alt={product.nameGlobal}
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-xl bg-gray-50 object-contain"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {product.brand}
            </p>
          )}
          <Link href={`/produto/${product.id}`} className="block">
            <h3 className="line-clamp-2 text-sm font-bold leading-snug hover:text-brand-600">
              {product.nameGlobal}
            </h3>
          </Link>
          {savingsPercent != null && savingsPercent > 0 && offers.length > 1 && (
            <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Poupa até {savingsPercent.toFixed(0)}%
            </p>
          )}
        </div>
        <AddToBasketButton productGlobalId={product.id} />
      </div>

      <ul className="mt-auto divide-y divide-gray-100 border-t border-gray-100">
        {offers.map((offer) => {
          const ppu = formatPricePerUnit(offer.pricePerUnit, offer.pricePerUnitUom);
          return (
            <li
              key={offer.productMarketId}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                offer.isCheapest ? "bg-brand-50" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: offer.supermarket.colorHex ?? "#999" }}
                  aria-hidden
                />
                <span className="text-sm font-medium">{offer.supermarket.name}</span>
                {offer.isCheapest && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Melhor preço
                  </span>
                )}
                {offer.hasPromo && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    Promo
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-2">
                  {offer.hasPromo && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatEuro(offer.priceRegular)}
                    </span>
                  )}
                  <span
                    className={`text-sm font-bold ${
                      offer.isCheapest ? "text-brand-700" : "text-gray-800"
                    }`}
                  >
                    {formatEuro(offer.effectivePrice)}
                  </span>
                </div>
                {ppu && <p className="text-[11px] text-gray-400">{ppu}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
