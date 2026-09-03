import Link from "next/link";
import { TrendingDown } from "lucide-react";
import type { PriceDrop } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { SupermarketDot } from "@/components/ui/SupermarketDot";
import { ProductImage } from "@/components/ProductImage";

export function BiggestDrops({ drops, title = "Maiores descidas" }: { drops: PriceDrop[]; title?: string }) {
  if (drops.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionHeading
        eyebrow={
          <>
            <TrendingDown className="h-3.5 w-3.5" /> Descidas de preço
          </>
        }
        title={title}
        description="Produtos com maior queda face ao último preço registado no mesmo supermercado."
      >
        <Badge variant="promo" className="px-3 py-1 text-[11px]">
          {drops.length} descidas
        </Badge>
      </SectionHeading>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {drops.map((drop) => (
          <Link
            key={`${drop.product.id}-${drop.supermarket.slug}`}
            href={`/produto/${drop.product.id}`}
            className="group flex min-h-44 flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-red-300 hover:shadow-lift dark:hover:border-red-800/60"
          >
            <div className="flex items-start justify-between gap-2">
              <ProductImage
                src={drop.product.imageUrl}
                alt=""
                name={drop.product.nameGlobal}
                brand={drop.product.brand}
                className="h-14 w-14 rounded-xl ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10"
              />
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm shadow-red-500/30 tabular">
                -{drop.dropPercent.toFixed(0)}%
              </span>
            </div>
            <h3 className="mt-4 line-clamp-2 text-sm font-extrabold leading-snug text-foreground transition-colors group-hover:text-red-600 dark:group-hover:text-red-400">
              {drop.product.nameGlobal}
            </h3>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <SupermarketDot supermarket={drop.supermarket} size="sm" />
              {drop.supermarket.name}
            </p>
            <div className="mt-auto flex items-baseline gap-2 pt-3">
              <span className="text-[11px] text-muted-foreground line-through tabular">{formatEuro(drop.previousPrice)}</span>
              <span className="font-display text-xl font-extrabold tracking-tight text-brand-700 tabular dark:text-brand-300">
                {formatEuro(drop.currentPrice)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
