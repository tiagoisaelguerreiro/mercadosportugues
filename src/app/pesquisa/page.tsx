import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { parseBrowseSearchParams, type SearchParamsRecord } from "@/lib/browse-url";
import { POPULAR_TERMS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}): Promise<Metadata> {
  const { q } = parseBrowseSearchParams(await searchParams);
  if (q) {
    return {
      title: `“${q}” — comparação de preços`,
      description: `Compara o preço de ${q} no Continente, Pingo Doce, Auchan, Lidl e mais supermercados.`,
      robots: { index: false, follow: true },
    };
  }
  return {
    title: "Catálogo de produtos",
    description:
      "Explora todos os produtos monitorizados com preços por supermercado, filtros por categoria e promoções.",
    alternates: { canonical: "/pesquisa" },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const state = parseBrowseSearchParams(await searchParams);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-3xl space-y-4">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
            <Sparkles className="h-4 w-4" />
            Motor de comparação
          </p>
          <SearchBar initialQuery={state.q} />
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="mr-1 font-semibold text-muted-foreground">Sugestões:</span>
            {POPULAR_TERMS.map((term) => (
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
      </section>

      <CatalogBrowser
        basePath="/pesquisa"
        state={state}
        heading={
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {state.q ? (
              <>
                Resultados para <span className="text-brand-600 dark:text-brand-400">“{state.q}”</span>
              </>
            ) : (
              "Catálogo de produtos"
            )}
          </h1>
        }
      />
    </div>
  );
}
