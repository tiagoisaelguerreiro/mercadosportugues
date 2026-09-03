import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { CategoryIcon } from "@/components/CategoryIcon";
import { findCategoryBySlug, getCachedCategories } from "@/lib/data";
import { parseBrowseSearchParams, type SearchParamsRecord } from "@/lib/browse-url";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) return { title: "Categoria não encontrada" };
  return {
    title: `${category.name} — preços por supermercado`,
    description: `Compara os preços de ${category.name.toLowerCase()} no Continente, Pingo Doce, Auchan, Lidl e mais supermercados.`,
    alternates: { canonical: `/categoria/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, categories] = await Promise.all([findCategoryBySlug(slug), getCachedCategories()]);
  if (!category) notFound();

  const state = parseBrowseSearchParams(sp);

  return (
    <div className="space-y-8">
      <nav aria-label="Caminho" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Início
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/categorias" className="hover:text-foreground">
          Categorias
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
          <CategoryIcon category={category} className="h-7 w-7" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">Categoria</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{category.name}</h1>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categoria/${c.slug}`}
            aria-current={c.id === category.id ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              c.id === category.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground/80 hover:border-brand-300 hover:text-foreground dark:hover:border-brand-700",
            )}
          >
            <CategoryIcon category={c} className="h-3.5 w-3.5" />
            {c.name}
          </Link>
        ))}
      </div>

      <CatalogBrowser
        basePath={`/categoria/${category.slug}`}
        state={state}
        locked={{ category }}
        heading={
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            {state.q ? (
              <>
                “{state.q}” em {category.name}
              </>
            ) : (
              `Produtos em ${category.name}`
            )}
          </h2>
        }
      />
    </div>
  );
}
