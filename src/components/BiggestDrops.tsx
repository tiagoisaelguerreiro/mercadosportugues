import Link from "next/link";
import type { PriceDrop } from "@/lib/types";
import { formatEuro } from "@/lib/format";

export function BiggestDrops({ drops }: { drops: PriceDrop[] }) {
  if (drops.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-extrabold">As maiores baixas de preço do dia</h2>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
          ↓ promoções
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {drops.map((drop) => (
          <Link
            key={`${drop.product.id}-${drop.supermarket.slug}`}
            href={`/produto/${drop.product.id}`}
            className="flex flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={drop.product.imageUrl ?? "https://placehold.co/80x80/png?text=P"}
                alt={drop.product.nameGlobal}
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg bg-gray-50 object-contain"
                loading="lazy"
              />
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                -{drop.dropPercent.toFixed(0)}%
              </span>
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
              {drop.product.nameGlobal}
            </h3>
            <p className="mt-1 text-xs text-gray-500">{drop.supermarket.name}</p>
            <div className="mt-auto flex items-baseline gap-2 pt-2">
              <span className="text-xs text-gray-400 line-through">
                {formatEuro(drop.previousPrice)}
              </span>
              <span className="text-base font-bold text-brand-700">
                {formatEuro(drop.currentPrice)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
