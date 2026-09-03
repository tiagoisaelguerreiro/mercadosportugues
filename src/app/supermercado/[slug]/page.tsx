import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, Percent, ShoppingBag, Trophy, Scale } from "lucide-react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { StatCard } from "@/components/ui/StatCard";
import { SupermarketAvatar } from "@/components/ui/SupermarketDot";
import { Badge } from "@/components/ui/Badge";
import { rankSupermarkets } from "@/components/SupermarketRanking";
import { findSupermarketBySlug, getCachedSupermarketSummaries } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { parseBrowseSearchParams, type SearchParamsRecord } from "@/lib/browse-url";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const s = await findSupermarketBySlug(slug);
  if (!s) return { title: "Supermercado não encontrado" };
  return {
    title: `${s.name} — preços e promoções de hoje`,
    description: `Todos os preços monitorizados no ${s.name}, comparados com os outros supermercados. Vê onde o ${s.name} é o mais barato.`,
    alternates: { canonical: `/supermercado/${s.slug}` },
  };
}

export default async function SupermarketPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [supermarket, summaries] = await Promise.all([findSupermarketBySlug(slug), getCachedSupermarketSummaries()]);
  if (!supermarket) notFound();

  const position = rankSupermarkets(summaries).findIndex((s) => s.supermarket.id === supermarket.id);
  const summary = summaries.find((s) => s.supermarket.id === supermarket.id) ?? null;
  const state = parseBrowseSearchParams(sp);
  const host = safeHost(supermarket.baseUrl);

  return (
    <div className="space-y-8">
      <nav aria-label="Caminho" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Início
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/supermercados" className="hover:text-foreground">
          Supermercados
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{supermarket.name}</span>
      </nav>

      <header
        className="relative overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-8"
        style={{ borderColor: `${supermarket.colorHex ?? "#64748b"}55` }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: supermarket.colorHex ?? "#64748b" }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-5">
          <SupermarketAvatar supermarket={supermarket} className="h-16 w-16 rounded-3xl text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{supermarket.name}</h1>
              {!supermarket.isActive && <Badge variant="muted">Não monitorizado</Badge>}
              {position === 0 && (
                <Badge variant="amber">
                  <Trophy className="h-3 w-3" /> Nº 1 do ranking
                </Badge>
              )}
              {position > 0 && <Badge variant="outline">Nº {position + 1} do ranking</Badge>}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Preços recolhidos diariamente da loja online do {supermarket.name} e comparados com os restantes supermercados
              para os mesmos produtos.
            </p>
          </div>
          {host && (
            <a
              href={supermarket.baseUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition hover:border-brand-300 hover:text-brand-700 dark:hover:border-brand-700 dark:hover:text-brand-300"
            >
              {host}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>

      {summary && summary.offerCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Produtos monitorizados" value={formatNumber(summary.offerCount)} icon={ShoppingBag} />
          <StatCard
            label="Mais barato em"
            value={`${summary.cheapestShare.toFixed(0)}%`}
            hint={`${formatNumber(summary.cheapestCount)} produtos ao preço mais baixo`}
            icon={Trophy}
            tone="brand"
          />
          <StatCard
            label="Em promoção"
            value={formatNumber(summary.promoCount)}
            hint={
              summary.offerCount > 0
                ? `${((summary.promoCount / summary.offerCount) * 100).toFixed(0)}% do catálogo comparável`
                : undefined
            }
            icon={Percent}
            tone="amber"
          />
          <StatCard
            label="Índice de preço"
            value={summary.priceIndex == null ? "—" : summary.priceIndex.toFixed(1)}
            hint={
              summary.priceIndex == null
                ? "Sem produtos comparáveis"
                : summary.priceIndex < 100
                  ? `≈ ${(100 - summary.priceIndex).toFixed(1)}% abaixo da média`
                  : summary.priceIndex > 100
                    ? `≈ ${(summary.priceIndex - 100).toFixed(1)}% acima da média`
                    : "Na média dos supermercados"
            }
            icon={Scale}
            tone="dark"
          />
        </div>
      )}

      <CatalogBrowser
        basePath={`/supermercado/${supermarket.slug}`}
        state={state}
        locked={{ supermarket }}
        heading={
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            {state.q ? `“${state.q}” no ${supermarket.name}` : `Produtos disponíveis no ${supermarket.name}`}
          </h2>
        }
      />
    </div>
  );
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}
