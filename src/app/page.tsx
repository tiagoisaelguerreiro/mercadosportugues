import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  LayoutGrid,
  ShoppingBasket,
  Sparkles,
  Store,
  TicketPercent,
  TrendingDown,
} from "lucide-react";
import { getRepository } from "@/db/repository";
import {
  getActiveSupermarkets,
  getCachedStats,
  getCachedSupermarketSummaries,
  getCategoryOverview,
  siteUrl,
} from "@/lib/data";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { POPULAR_TERMS, SITE_NAME } from "@/lib/constants";
import { SearchBar } from "@/components/SearchBar";
import { BiggestDrops } from "@/components/BiggestDrops";
import { ProductCard } from "@/components/ProductCard";
import { SupermarketRanking, rankSupermarkets } from "@/components/SupermarketRanking";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SupermarketChip } from "@/components/ui/SupermarketDot";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repo = getRepository();
  const [drops, featuredBrowse, supermarkets, stats, summaries, categories] = await Promise.all([
    repo.biggestDrops(8),
    repo.browse({ sort: "savings", pageSize: 48 }),
    getActiveSupermarkets(),
    getCachedStats(),
    getCachedSupermarketSummaries(),
    getCategoryOverview(0),
  ]);
  const compared = featuredBrowse.items.filter((item) => item.offers.length >= 2).slice(0, 6);
  const featured = compared.length > 0 ? compared : featuredBrowse.items.slice(0, 6);

  const bestDrop = drops[0] ?? null;
  const leader = rankSupermarkets(summaries)[0];
  const base = siteUrl();
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: base,
    inLanguage: "pt-PT",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/pesquisa?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="space-y-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      {/* Hero */}
      <section className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-10 lg:p-12">
          <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-brand-500/15 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                Preços atualizados {formatRelativeDay(stats.lastCapturedAt)}
              </span>
              <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
              <span>{stats.activeSupermarkets} supermercados</span>
              <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
              <span>{formatNumber(stats.productCount)} produtos</span>
            </div>

            <h1 className="mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-foreground text-balance sm:text-6xl">
              Decide onde comprar{" "}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent dark:from-brand-400 dark:to-brand-200">
                antes de sair de casa.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Recolhemos todos os dias os preços das lojas online dos supermercados portugueses. Pesquisa um
              produto, compara por cadeia e descobre onde o teu carrinho fica mais barato.
            </p>

            <div className="mt-8 max-w-2xl space-y-3">
              <SearchBar />
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 font-semibold text-muted-foreground">Pesquisas frequentes:</span>
                {POPULAR_TERMS.slice(0, 7).map((term) => (
                  <Link
                    key={term}
                    href={`/pesquisa?q=${encodeURIComponent(term)}`}
                    className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-semibold text-foreground/80 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/30 dark:hover:text-brand-300"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {supermarkets.map((s) => (
                <SupermarketChip key={s.id} supermarket={s} href={`/supermercado/${s.slug}`} />
              ))}
            </div>
          </div>
        </div>

        <aside className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <Link
            href="/promocoes"
            className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-soft transition hover:shadow-lift dark:border-border dark:bg-card"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/25 blur-2xl transition group-hover:bg-red-500/40" aria-hidden />
            <div className="relative">
              <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                <TrendingDown className="h-3.5 w-3.5" /> Maior descida hoje
              </p>
              <p className="mt-4 font-display text-4xl font-extrabold tracking-tight tabular">
                {bestDrop ? `-${bestDrop.dropPercent.toFixed(0)}%` : "—"}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                {bestDrop ? `${bestDrop.product.nameGlobal} · ${bestDrop.supermarket.name}` : "Sem descidas relevantes hoje"}
              </p>
            </div>
          </Link>

          <Link
            href="/supermercados"
            className="group rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:border-brand-300 hover:shadow-lift dark:hover:border-brand-700"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Store className="h-3.5 w-3.5" /> Mais vezes barato
            </p>
            <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground">
              {leader ? leader.supermarket.name : "—"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {leader
                ? `preço mais baixo em ${leader.cheapestShare.toFixed(0)}% dos produtos que vende`
                : "ranking disponível com mais dados"}
            </p>
          </Link>

          <Link
            href="/carrinho"
            className="group block rounded-3xl border border-brand-200 bg-brand-50 p-6 shadow-soft transition hover:border-brand-400 hover:shadow-lift dark:border-brand-900/50 dark:bg-brand-950/20"
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-brand-700 dark:text-brand-400">
                <ShoppingBasket className="h-3.5 w-3.5" /> Comparador de carrinho
              </p>
              <ArrowRight className="h-4 w-4 text-brand-600 transition group-hover:translate-x-1 dark:text-brand-400" />
            </div>
            <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-brand-800 dark:text-brand-300">
              {formatNumber(stats.promoCount)} promoções
            </p>
            <p className="mt-2 text-sm text-brand-700/80 dark:text-brand-400/80">
              junta produtos e descobre o supermercado vencedor para o cabaz completo
            </p>
          </Link>
        </aside>
      </section>

      {/* Categorias */}
      {categories.length > 0 && (
        <section className="space-y-5">
          <SectionHeading
            eyebrow={
              <>
                <LayoutGrid className="h-3.5 w-3.5" /> Categorias
              </>
            }
            title="Explora por categoria"
            action={{ href: "/categorias", label: "Todas as categorias" }}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.slice(0, 8).map(({ category, productCount, promoCount }) => (
              <Link
                key={category.id}
                href={`/categoria/${category.slug}`}
                className="group flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift dark:hover:border-brand-700"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-400/10 dark:text-brand-300">
                    <CategoryIcon category={category} className="h-5 w-5" />
                  </span>
                  {promoCount > 0 && <Badge variant="promo">{promoCount} promo</Badge>}
                </div>
                <div>
                  <p className="font-display text-sm font-extrabold tracking-tight text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300">
                    {category.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatNumber(productCount)} produtos</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Descidas */}
      <BiggestDrops drops={drops} />

      {/* Ranking + como funciona */}
      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <SectionHeading
            eyebrow={
              <>
                <Store className="h-3.5 w-3.5" /> Ranking diário
              </>
            }
            title="Quem é mais barato hoje"
            description="Percentagem de produtos em que cada supermercado pratica o preço mais baixo."
            action={{ href: "/supermercados", label: "Ver ranking completo" }}
          />
          <SupermarketRanking summaries={summaries} limit={5} compact />
        </div>

        <div className="space-y-5">
          <SectionHeading
            eyebrow={
              <>
                <Sparkles className="h-3.5 w-3.5" /> Como funciona
              </>
            }
            title="Preços reais, todos os dias"
            action={{ href: "/sobre", label: "Saber mais" }}
          />
          <ol className="grid gap-3">
            {[
              {
                n: "01",
                title: "Recolha diária",
                text: "Todas as manhãs visitamos as lojas online de cada supermercado e registamos o preço de cada produto.",
              },
              {
                n: "02",
                title: "Correspondência de produtos",
                text: "Ligamos o mesmo artigo entre cadeias por código de barras e nome normalizado, com revisão manual dos casos duvidosos.",
              },
              {
                n: "03",
                title: "Comparação transparente",
                text: "Vês o preço por supermercado, o histórico, as descidas e o total do teu carrinho em cada cadeia.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
                <span className="font-display text-2xl font-extrabold tabular text-brand-600/60 dark:text-brand-400/60">{step.n}</span>
                <div>
                  <h3 className="font-display text-base font-extrabold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Destaques */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow={
            <>
              <TicketPercent className="h-3.5 w-3.5" /> Destaques
            </>
          }
          title="Onde a diferença de preço é maior"
          description="Produtos com maior poupança entre o supermercado mais caro e o mais barato."
          action={{ href: "/pesquisa?sort=savings", label: "Explorar catálogo" }}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item) => (
            <ProductCard key={item.product.id} data={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
