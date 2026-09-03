import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, Scale, ShoppingBasket, Sparkles, TrendingDown } from "lucide-react";
import { getRepository } from "@/db/repository";
import { computePriceStats } from "@/db/query-logic";
import { formatEuro, formatPricePerUnit, formatRelativeDay } from "@/lib/format";
import { getProductCached, parseProductId, siteUrl, dataSourceLabel } from "@/lib/data";
import type { ProductWithOffers } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { InteractivePriceHistory } from "@/components/InteractivePriceHistory";
import { AddToBasketButton } from "@/components/AddToBasketButton";
import { ShareButton } from "@/components/ShareButton";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { SupermarketDot } from "@/components/ui/SupermarketDot";
import { SectionHeading } from "@/components/ui/SectionHeading";

const HISTORY_DAYS = 30;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const globalId = parseProductId(id);
  const data = globalId ? await getProductCached(globalId) : null;
  if (!data) return { title: "Produto não encontrado", robots: { index: false } };
  const { product, cheapestPrice, offers } = data;
  const priceText = cheapestPrice != null ? ` desde ${formatEuro(cheapestPrice)}` : "";
  const stores = offers.map((o) => o.supermarket.name).join(", ");
  const description = `Preço de ${product.brand ? `${product.brand} ` : ""}${product.nameGlobal}${priceText}. Compara ${stores || "os supermercados"} e vê o histórico de preços.`;
  return {
    title: `${product.nameGlobal}${priceText}`,
    description,
    alternates: { canonical: `/produto/${product.id}` },
    openGraph: {
      title: `${product.nameGlobal}${priceText}`,
      description,
      type: "website",
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const globalId = parseProductId(id);
  if (!globalId) notFound();

  const repo = getRepository();
  const data = await getProductCached(globalId);
  if (!data) notFound();

  const { product, offers, category, savingsAbsolute, savingsPercent, cheapestPrice } = data;
  const [history, relatedResult] = await Promise.all([
    repo.getHistory(globalId, HISTORY_DAYS),
    category ? repo.browse({ categoryId: category.id, pageSize: 4, sort: "savings" }) : Promise.resolve(null),
  ]);
  const stats = computePriceStats(history.points, HISTORY_DAYS);
  const related = (relatedResult?.items ?? []).filter((p) => p.product.id !== product.id).slice(0, 3);
  const cheapest = offers[0] ?? null;
  const lastCaptured = offers.reduce<string | null>((acc, o) => (acc == null || o.capturedAt > acc ? o.capturedAt : acc), null);
  const quantityLabel =
    product.quantityValue != null && product.quantityUnit ? `${product.quantityValue} ${product.quantityUnit}` : null;

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        // JSON-LD gerado a partir de dados internos (sem input de utilizador).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(data)) }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          {category ? (
            <Link href={`/categoria/${category.slug}`} className="hover:text-foreground">
              {category.name}
            </Link>
          ) : (
            <Link href="/pesquisa" className="hover:text-foreground">
              Catálogo
            </Link>
          )}
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="max-w-[200px] truncate text-foreground sm:max-w-xs">{product.nameGlobal}</span>
        </nav>
        <ShareButton title={`${product.nameGlobal} — MercadosPortugues`} />
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.7fr)]">
        <div>
          <div className="sticky top-24 rounded-4xl border border-border bg-card p-6 text-center shadow-soft">
            <ProductImage
              src={product.imageUrl}
              alt={product.nameGlobal}
              name={product.nameGlobal}
              brand={product.brand}
              className="mx-auto h-64 w-64 rounded-3xl ring-1 ring-black/5 dark:ring-white/10"
            />
            <dl className="mt-5 grid gap-1.5 text-left text-xs">
              {product.brand && <Row label="Marca" value={product.brand} />}
              {quantityLabel && <Row label="Quantidade" value={quantityLabel} />}
              {product.eanCode && <Row label="EAN" value={<span className="font-mono tabular">{product.eanCode}</span>} />}
              {category && (
                <Row
                  label="Categoria"
                  value={
                    <Link href={`/categoria/${category.slug}`} className="font-bold text-brand-700 hover:underline dark:text-brand-300">
                      {category.name}
                    </Link>
                  }
                />
              )}
              {lastCaptured && <Row label="Atualizado" value={formatRelativeDay(lastCaptured)} />}
            </dl>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            {product.brand && <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{product.brand}</p>}
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground text-balance sm:text-4xl">
              {product.nameGlobal}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Disponível em {offers.length} supermercado{offers.length === 1 ? "" : "s"}
              {cheapestPrice != null && offers.length > 1 && data.priciestPrice != null && (
                <>
                  {" "}
                  · de <strong className="text-foreground tabular">{formatEuro(cheapestPrice)}</strong> a{" "}
                  <strong className="text-foreground tabular">{formatEuro(data.priciestPrice)}</strong>
                </>
              )}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {cheapest && (
              <div className="rounded-3xl border border-brand-200 bg-brand-50/80 p-5 shadow-soft dark:border-brand-900/50 dark:bg-brand-950/20">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  <Sparkles className="h-3.5 w-3.5" /> Melhor preço hoje
                </span>
                <p className="mt-2 font-display text-3xl font-extrabold text-brand-800 tabular dark:text-brand-300">
                  {formatEuro(cheapest.effectivePrice)}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700/90 dark:text-brand-400/90">
                  <SupermarketDot supermarket={cheapest.supermarket} size="sm" /> {cheapest.supermarket.name}
                </p>
              </div>
            )}

            {savingsAbsolute != null && savingsAbsolute > 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-soft dark:border-amber-900/50 dark:bg-amber-950/20">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <TrendingDown className="h-3.5 w-3.5" /> Poupança máxima
                </span>
                <p className="mt-2 font-display text-3xl font-extrabold text-amber-800 tabular dark:text-amber-300">{formatEuro(savingsAbsolute)}</p>
                <p className="mt-1 text-xs font-bold text-amber-700/90 dark:text-amber-400/90">
                  {savingsPercent != null && `${savingsPercent.toFixed(0)}% entre o mais caro e o mais barato`}
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" /> Mínimo em {HISTORY_DAYS} dias
                </span>
                <p className="mt-2 font-display text-3xl font-extrabold text-foreground tabular">{formatEuro(stats.min)}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">
                  {stats.current != null && stats.min != null && stats.current <= stats.min
                    ? "Hoje está no mínimo do período"
                    : stats.avg != null
                      ? `média ${formatEuro(stats.avg)}`
                      : ""}
                </p>
              </div>
            )}

            <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <ShoppingBasket className="h-3.5 w-3.5" /> Carrinho
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Adiciona e compara o cabaz completo.</p>
              </div>
              <div className="mt-3">
                <AddToBasketButton productGlobalId={product.id} />
              </div>
            </div>
          </div>

          {/* Ofertas — mobile */}
          <ul className="space-y-2.5 sm:hidden">
            {offers.map((offer) => {
              const ppu = formatPricePerUnit(offer.pricePerUnit, offer.pricePerUnitUom);
              return (
                <li
                  key={offer.productMarketId}
                  className={cn(
                    "rounded-2xl border p-4 shadow-soft",
                    offer.isCheapest ? "border-brand-200 bg-brand-50/70 dark:border-brand-900/40 dark:bg-brand-900/10" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/supermercado/${offer.supermarket.slug}`} className="flex items-center gap-2">
                        <SupermarketDot supermarket={offer.supermarket} size="lg" />
                        <span className="truncate text-sm font-extrabold text-foreground">{offer.supermarket.name}</span>
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {offer.isCheapest && <Badge variant="brand">Melhor preço</Badge>}
                        {offer.hasPromo && <Badge variant="promo">Promoção</Badge>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {offer.hasPromo && <p className="text-[11px] text-muted-foreground line-through tabular">{formatEuro(offer.priceRegular)}</p>}
                      <p className={cn("font-display text-lg font-extrabold tabular", offer.isCheapest ? "text-brand-700 dark:text-brand-300" : "text-foreground")}>
                        {formatEuro(offer.effectivePrice)}
                      </p>
                      {ppu && <p className="text-xs text-muted-foreground">{ppu}</p>}
                    </div>
                  </div>
                  {offer.productUrl && (
                    <a
                      href={offer.productUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      Ver no {offer.supermarket.name} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Ofertas — desktop */}
          <div className="hidden overflow-hidden rounded-3xl border border-border bg-card shadow-soft sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">Supermercado</th>
                  <th className="px-5 py-3.5 text-right">Preço / unidade</th>
                  <th className="px-5 py-3.5 text-right">Preço</th>
                  <th className="px-5 py-3.5 text-right">vs. mais barato</th>
                  <th className="w-14 px-4 py-3.5 text-center">Loja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {offers.map((offer) => {
                  const ppu = formatPricePerUnit(offer.pricePerUnit, offer.pricePerUnitUom);
                  const diff = cheapestPrice != null ? offer.effectivePrice - cheapestPrice : null;
                  return (
                    <tr key={offer.productMarketId} className={offer.isCheapest ? "bg-brand-50/50 dark:bg-brand-900/10" : "transition-colors hover:bg-muted/30"}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <SupermarketDot supermarket={offer.supermarket} size="lg" />
                          <Link href={`/supermercado/${offer.supermarket.slug}`} className="font-bold text-foreground hover:underline">
                            {offer.supermarket.name}
                          </Link>
                          {offer.isCheapest && <Badge variant="brand">Melhor preço</Badge>}
                          {offer.hasPromo && <Badge variant="promo">Promoção</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-medium text-muted-foreground tabular">{ppu ?? "—"}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-baseline justify-end gap-2">
                          {offer.hasPromo && <span className="text-[11px] text-muted-foreground line-through tabular">{formatEuro(offer.priceRegular)}</span>}
                          <span className={cn("font-display text-base font-extrabold tabular", offer.isCheapest ? "text-brand-700 dark:text-brand-300" : "text-foreground")}>
                            {formatEuro(offer.effectivePrice)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-semibold tabular">
                        {diff == null || diff <= 0.004 ? (
                          <span className="text-brand-700 dark:text-brand-300">—</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">+{formatEuro(diff)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {offer.productUrl ? (
                          <a
                            href={offer.productUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title={`Abrir no ${offer.supermarket.name}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <InteractivePriceHistory
        productId={globalId}
        initial={{ supermarkets: history.supermarkets, points: history.points, stats }}
        initialDays={HISTORY_DAYS}
        isDemo={dataSourceLabel() === "demo"}
      />

      {related.length > 0 && category && (
        <section className="space-y-5">
          <SectionHeading
            eyebrow="Relacionados"
            title={`Mais em ${category.name}`}
            action={{ href: `/categoria/${category.slug}`, label: "Ver categoria" }}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.product.id} data={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5 first:border-t-0 first:pt-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** Schema.org Product + AggregateOffer para rich results. */
function productJsonLd(data: ProductWithOffers) {
  const { product, offers, cheapestPrice, priciestPrice } = data;
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameGlobal,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    gtin13: product.eanCode ?? undefined,
    image: product.imageUrl ?? undefined,
    url: `${base}/produto/${product.id}`,
    offers:
      offers.length > 0
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: cheapestPrice ?? undefined,
            highPrice: priciestPrice ?? undefined,
            offerCount: offers.length,
            offers: offers.map((o) => ({
              "@type": "Offer",
              price: o.effectivePrice,
              priceCurrency: "EUR",
              availability: "https://schema.org/InStock",
              url: o.productUrl ?? undefined,
              seller: { "@type": "Organization", name: o.supermarket.name },
            })),
          }
        : undefined,
  };
}
