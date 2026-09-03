import Link from "next/link";
import { RotateCcw, SearchX, Store, Tag, TicketPercent } from "lucide-react";
import { getRepository } from "@/db/repository";
import { getActiveSupermarkets, getCachedCategories } from "@/lib/data";
import {
  buildBrowseHref,
  toBrowseParams,
  type BrowseUrlState,
} from "@/lib/browse-url";
import type { BrowseSort, Category, Supermarket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SupermarketDot } from "@/components/ui/SupermarketDot";
import { SortSelect } from "./SortSelect";

interface LockedFilters {
  /** Categoria fixa pelo caminho (ex.: /categoria/laticinios). */
  category?: Category;
  /** Supermercado fixo pelo caminho (ex.: /supermercado/lidl). */
  supermarket?: Supermarket;
  /** Apenas promocoes (ex.: /promocoes). */
  onlyPromo?: boolean;
}

interface Props {
  basePath: string;
  state: BrowseUrlState;
  locked?: LockedFilters;
  pageSize?: number;
  /** Ordenacao quando a URL nao especifica nenhuma. */
  defaultSort?: BrowseSort;
  /** Titulo do bloco de resultados (h1 nas paginas de catalogo). */
  heading?: React.ReactNode;
}

/**
 * Navegador de catalogo server-side: filtros expressos na URL (funcionam sem
 * JavaScript e sao indexaveis), resultados paginados e ordenacao.
 */
export async function CatalogBrowser({ basePath, state, locked = {}, pageSize, defaultSort, heading }: Props) {
  const repo = getRepository();
  const [categories, supermarkets] = await Promise.all([getCachedCategories(), getActiveSupermarkets()]);

  const category = locked.category ?? (state.cat ? categories.find((c) => c.slug === state.cat) ?? null : null);
  const supermarket =
    locked.supermarket ?? (state.loja ? supermarkets.find((s) => s.slug === state.loja) ?? null : null);
  const onlyPromo = locked.onlyPromo ?? state.promo;
  const effectiveSort: BrowseSort = state.sort ?? defaultSort ?? (state.q ? "relevance" : "cheapest");

  const result = await repo.browse({
    ...toBrowseParams(
      state,
      { categoryId: category?.id ?? null, supermarketSlug: supermarket?.slug ?? null, onlyPromo },
      pageSize,
    ),
    sort: effectiveSort,
  });

  const omit: Array<keyof BrowseUrlState> = [];
  if (locked.category) omit.push("cat");
  if (locked.supermarket) omit.push("loja");
  if (locked.onlyPromo) omit.push("promo");

  const href = (patch: Partial<BrowseUrlState>) => buildBrowseHref(basePath, state, patch, omit);
  const sortHrefs = Object.fromEntries(
    (["relevance", "cheapest", "savings", "promo", "name"] as BrowseSort[]).map((s) => [s, href({ sort: s })]),
  ) as Record<BrowseSort, string>;

  const activeCount =
    (!locked.category && category ? 1 : 0) +
    (!locked.supermarket && supermarket ? 1 : 0) +
    (!locked.onlyPromo && onlyPromo ? 1 : 0);

  const showCategoryRow = !locked.category && categories.length > 0;
  const showSupermarketRow = !locked.supermarket && supermarkets.length > 0;
  const showPromoToggle = !locked.onlyPromo;

  const rangeStart = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const rangeEnd = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="space-y-6">
      {(showCategoryRow || showSupermarketRow || showPromoToggle) && (
        <section
          aria-label="Filtros"
          className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5"
        >
          {showCategoryRow && (
            <FilterRow icon={Tag} label="Categoria">
              <Chip href={href({ cat: null })} active={!category}>
                Todas
              </Chip>
              {categories.map((c) => (
                <Chip key={c.id} href={href({ cat: category?.id === c.id ? null : c.slug })} active={category?.id === c.id}>
                  {c.name}
                </Chip>
              ))}
            </FilterRow>
          )}

          {(showSupermarketRow || showPromoToggle) && (
            <div className={cn("flex flex-wrap items-start justify-between gap-3", showCategoryRow && "border-t border-border/60 pt-4")}>
              {showSupermarketRow && (
                <FilterRow icon={Store} label="Supermercado" className="min-w-0 flex-1">
                  <Chip href={href({ loja: null })} active={!supermarket} round>
                    Todos
                  </Chip>
                  {supermarkets.map((s) => (
                    <Chip
                      key={s.id}
                      href={href({ loja: supermarket?.id === s.id ? null : s.slug })}
                      active={supermarket?.id === s.id}
                      round
                    >
                      <SupermarketDot supermarket={s} size="sm" />
                      {s.name}
                    </Chip>
                  ))}
                </FilterRow>
              )}
              {showPromoToggle && (
                <Link
                  href={href({ promo: !onlyPromo })}
                  aria-pressed={onlyPromo}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition",
                    onlyPromo
                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                      : "border-border bg-card text-foreground/80 hover:border-red-300 hover:text-red-600 dark:hover:border-red-800",
                  )}
                >
                  <TicketPercent className="h-4 w-4" />
                  Só promoções
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {heading}
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {result.total === 0
                ? "Sem produtos para estes critérios."
                : `A mostrar ${rangeStart}–${rangeEnd} de ${result.total} produto${result.total === 1 ? "" : "s"}.`}
              {activeCount > 0 && (
                <>
                  {" "}
                  <Link
                    href={buildBrowseHref(basePath, state, { cat: null, loja: null, promo: false }, omit)}
                    className="inline-flex items-center gap-1 font-bold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Limpar {activeCount} filtro{activeCount > 1 ? "s" : ""}
                  </Link>
                </>
              )}
            </p>
          </div>
          <SortSelect value={effectiveSort} hrefs={sortHrefs} hasQuery={Boolean(state.q)} />
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum produto corresponde aos critérios"
            description="Experimenta remover filtros ou pesquisar por outro termo como leite, azeite ou arroz."
          >
            {activeCount > 0 && (
              <Link
                href={buildBrowseHref(basePath, state, { cat: null, loja: null, promo: false }, omit)}
                className="rounded-2xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-500"
              >
                Limpar filtros
              </Link>
            )}
            <Link
              href="/pesquisa"
              className="rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted"
            >
              Ver todo o catálogo
            </Link>
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((item) => (
                <ProductCard key={item.product.id} data={item} />
              ))}
            </div>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              hrefFor={(p) => href({ page: p })}
              className="mt-10"
            />
          </>
        )}
      </section>
    </div>
  );
}

function FilterRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  round = false,
  children,
}: {
  href: string;
  active: boolean;
  round?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition",
        round ? "rounded-full uppercase tracking-wider text-[11px]" : "rounded-xl",
        active
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border bg-card text-foreground/80 hover:border-brand-300 hover:text-foreground dark:hover:border-brand-700",
      )}
    >
      {children}
    </Link>
  );
}
