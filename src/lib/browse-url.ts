import type { BrowseParams, BrowseSort } from "@/lib/types";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export const BROWSE_SORTS: ReadonlyArray<{ value: BrowseSort; label: string }> = [
  { value: "relevance", label: "Relevância" },
  { value: "cheapest", label: "Menor preço" },
  { value: "savings", label: "Maior poupança" },
  { value: "promo", label: "Maior desconto" },
  { value: "name", label: "Nome (A–Z)" },
];

const SORT_VALUES = new Set<string>(BROWSE_SORTS.map((s) => s.value));

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Estado dos filtros expresso na URL (todos opcionais). */
export interface BrowseUrlState {
  q: string;
  cat: string | null; // slug da categoria
  loja: string | null; // slug do supermercado
  promo: boolean;
  sort: BrowseSort | null;
  page: number;
}

export function parseBrowseSearchParams(sp: SearchParamsRecord): BrowseUrlState {
  const sortRaw = first(sp.sort);
  const pageRaw = Number(first(sp.page) ?? 1);
  return {
    q: (first(sp.q) ?? "").trim(),
    cat: first(sp.cat)?.trim() || null,
    loja: first(sp.loja)?.trim() || null,
    promo: first(sp.promo) === "1" || first(sp.promo) === "true",
    sort: sortRaw && SORT_VALUES.has(sortRaw) ? (sortRaw as BrowseSort) : null,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  };
}

/**
 * Constroi o href de uma pagina de catalogo a partir do estado atual e de
 * alteracoes pontuais. Qualquer alteracao de filtro repoe a pagina 1.
 */
export function buildBrowseHref(
  basePath: string,
  state: BrowseUrlState,
  patch: Partial<BrowseUrlState> = {},
  omit: Array<keyof BrowseUrlState> = [],
): string {
  const next: BrowseUrlState = { ...state, ...patch };
  const filterChanged = Object.keys(patch).some((k) => k !== "page");
  if (filterChanged && patch.page === undefined) next.page = 1;

  const params = new URLSearchParams();
  const skip = new Set(omit);
  if (next.q && !skip.has("q")) params.set("q", next.q);
  if (next.cat && !skip.has("cat")) params.set("cat", next.cat);
  if (next.loja && !skip.has("loja")) params.set("loja", next.loja);
  if (next.promo && !skip.has("promo")) params.set("promo", "1");
  if (next.sort && !skip.has("sort")) params.set("sort", next.sort);
  if (next.page > 1 && !skip.has("page")) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function toBrowseParams(
  state: BrowseUrlState,
  resolved: { categoryId?: number | null; supermarketSlug?: string | null; onlyPromo?: boolean },
  pageSize?: number,
): BrowseParams {
  return {
    query: state.q || undefined,
    categoryId: resolved.categoryId ?? null,
    supermarketSlug: resolved.supermarketSlug ?? null,
    onlyPromo: resolved.onlyPromo ?? state.promo,
    sort: state.sort ?? undefined,
    page: state.page,
    pageSize,
  };
}
