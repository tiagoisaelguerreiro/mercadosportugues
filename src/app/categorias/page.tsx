import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Tag } from "lucide-react";
import { getCategoryOverview } from "@/lib/data";
import { formatEuro, formatNumber } from "@/lib/format";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ProductImage } from "@/components/ProductImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categorias de produtos",
  description: "Navega o catálogo por categoria e compara preços entre supermercados em cada uma.",
  alternates: { canonical: "/categorias" },
};

export default async function CategoriesPage() {
  const overview = await getCategoryOverview(3);
  const totalProducts = overview.reduce((s, c) => s + c.productCount, 0);

  return (
    <div className="space-y-10">
      <SectionHeading
        as="h1"
        eyebrow={
          <>
            <LayoutGrid className="h-3.5 w-3.5" /> Categorias
          </>
        }
        title="Explora por categoria"
        description={`${formatNumber(totalProducts)} produtos organizados em ${overview.length} categorias, com preços comparados entre supermercados.`}
        action={{ href: "/pesquisa", label: "Catálogo completo" }}
      />

      {overview.length === 0 ? (
        <EmptyState icon={Tag} title="Ainda não há categorias" description="Assim que houver dados de scraping as categorias aparecem aqui." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {overview.map(({ category, productCount, promoCount, sample }) => (
            <article
              key={category.id}
              className="group relative flex flex-col overflow-hidden rounded-4xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift dark:hover:border-brand-700/60"
            >
              <Link href={`/categoria/${category.slug}`} className="flex items-start justify-between gap-4 p-6 pb-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-400/10 dark:text-brand-300">
                    <CategoryIcon category={category} className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{category.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold">{formatNumber(productCount)} produtos</span>
                      {promoCount > 0 && <Badge variant="promo">{promoCount} em promoção</Badge>}
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
              </Link>

              {sample.length > 0 && (
                <ul className="mt-auto divide-y divide-border/60 border-t border-border/60 bg-muted/30">
                  {sample.map((item) => (
                    <li key={item.product.id}>
                      <Link
                        href={`/produto/${item.product.id}`}
                        className="flex items-center gap-3 px-6 py-2.5 text-sm transition hover:bg-muted/60"
                      >
                        <ProductImage
                          src={item.product.imageUrl}
                          alt=""
                          name={item.product.nameGlobal}
                          brand={item.product.brand}
                          className="h-8 w-8 rounded-lg ring-1 ring-black/5 dark:ring-white/10"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-foreground/90">{item.product.nameGlobal}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">desde</span>
                        <span className="shrink-0 font-black text-brand-700 tabular dark:text-brand-300">
                          {formatEuro(item.cheapestPrice)}
                        </span>
                        {item.savingsPercent != null && item.savingsPercent > 0 && (
                          <Badge variant="amber">-{item.savingsPercent.toFixed(0)}%</Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
