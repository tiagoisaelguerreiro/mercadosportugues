import type {
  BasketComparison,
  BasketLine,
  BasketSupermarketResult,
  BrowseParams,
  BrowseResult,
  BrowseSort,
  Category,
  HistoryPoint,
  MarketOffer,
  PriceDrop,
  PricePoint,
  PriceStats,
  ProductGlobal,
  ProductMarket,
  ProductWithOffers,
  ReviewGlobalInput,
  Supermarket,
  SupermarketSummary,
} from "@/lib/types";
import { round2 } from "@/db/repository-types";
import { parseQuantity } from "@/lib/parsing";

export const BROWSE_DEFAULT_PAGE_SIZE = 24;
export const BROWSE_MAX_PAGE_SIZE = 60;

/** Preco que o cliente paga: promocional quando existe, caso contrario o regular. */
export function effectivePrice(point: Pick<PricePoint, "priceRegular" | "pricePromo">): number {
  return point.pricePromo ?? point.priceRegular;
}

/**
 * Constroi a lista de ofertas (uma por supermercado) a partir das ofertas de
 * mercado e dos respetivos precos mais recentes, ordenada do mais barato ao
 * mais caro e com a flag `isCheapest` marcada.
 */
export function buildOffers(
  markets: ProductMarket[],
  latestByMarket: Map<number, PricePoint>,
  supermarketById: Map<number, Supermarket>,
): MarketOffer[] {
  const offers: MarketOffer[] = [];
  for (const m of markets) {
    const latest = latestByMarket.get(m.id);
    if (!latest) continue;
    const supermarket = supermarketById.get(m.supermarketId);
    if (!supermarket || !supermarket.isActive) continue;
    offers.push({
      supermarket,
      productMarketId: m.id,
      effectivePrice: effectivePrice(latest),
      priceRegular: latest.priceRegular,
      pricePromo: latest.pricePromo,
      hasPromo: latest.hasPromo,
      pricePerUnit: latest.pricePerUnit,
      pricePerUnitUom: latest.pricePerUnitUom,
      productUrl: m.productUrl,
      capturedAt: latest.capturedAt,
      isCheapest: false,
    });
  }
  const unique = new Map<number, MarketOffer>();
  for (const offer of offers) {
    const prev = unique.get(offer.supermarket.id);
    if (!prev || offer.effectivePrice < prev.effectivePrice) {
      unique.set(offer.supermarket.id, offer);
    }
  }
  const sorted = [...unique.values()].sort((a, b) => a.effectivePrice - b.effectivePrice);
  if (sorted.length > 0) {
    const min = sorted[0].effectivePrice;
    for (const o of sorted) o.isCheapest = o.effectivePrice === min;
  }
  return sorted;
}

/** Compoe o produto global com as suas ofertas e calcula a poupanca maxima. */
export function toProductWithOffers(
  global: ProductGlobal,
  offers: MarketOffer[],
  category: Category | null,
): ProductWithOffers {
  const cheapest = offers.length ? offers[0].effectivePrice : null;
  const priciest = offers.length ? offers[offers.length - 1].effectivePrice : null;
  const savingsAbsolute =
    cheapest != null && priciest != null ? round2(priciest - cheapest) : null;
  const savingsPercent =
    cheapest != null && priciest != null && priciest > 0
      ? round2(((priciest - cheapest) / priciest) * 100)
      : null;
  return {
    product: global,
    category,
    offers,
    cheapestPrice: cheapest,
    priciestPrice: priciest,
    savingsAbsolute,
    savingsPercent,
  };
}

/**
 * Calcula o custo de um carrinho em cada supermercado e elege o vencedor:
 * o mais barato que tem TODOS os itens; se nenhum tiver tudo, o mais barato
 * entre os que tem mais itens.
 *
 * `priceLookup(productGlobalId, supermarketId)` devolve o preco efetivo unitario
 * ou `null` se o produto nao existir nesse supermercado.
 */
export function computeBasket(
  lines: BasketLine[],
  supermarkets: Supermarket[],
  productNameById: Map<number, string>,
  priceLookup: (productGlobalId: number, supermarketId: number) => number | null,
): BasketComparison {
  const results: BasketSupermarketResult[] = supermarkets
    .filter((s) => s.isActive)
    .map((supermarket) => {
      let total = 0;
      let available = 0;
      let missing = 0;
      const missingProductIds: number[] = [];
      const resultLines: BasketSupermarketResult["lines"] = [];

      for (const line of lines) {
        const qty = Math.max(1, Math.floor(line.quantity || 1));
        const productName = productNameById.get(line.productGlobalId) ?? `#${line.productGlobalId}`;
        const unitPrice = priceLookup(line.productGlobalId, supermarket.id);
        if (unitPrice != null) {
          const lineTotal = round2(unitPrice * qty);
          total = round2(total + lineTotal);
          available++;
          resultLines.push({
            productGlobalId: line.productGlobalId,
            productName,
            quantity: qty,
            unitPrice,
            lineTotal,
            available: true,
          });
        } else {
          missing++;
          missingProductIds.push(line.productGlobalId);
          resultLines.push({
            productGlobalId: line.productGlobalId,
            productName,
            quantity: qty,
            unitPrice: null,
            lineTotal: null,
            available: false,
          });
        }
      }

      return {
        supermarket,
        total,
        itemsAvailable: available,
        itemsMissing: missing,
        missingProductIds,
        lines: resultLines,
        isComplete: missing === 0 && available > 0,
        isWinner: false,
      };
    });

  const withItems = results.filter((r) => r.itemsAvailable > 0);
  // Cestos completos primeiro (comparáveis entre si); os incompletos têm
  // totais artificialmente baixos, por isso ficam depois, com menos faltas à frente.
  withItems.sort(
    (a, b) =>
      Number(b.isComplete) - Number(a.isComplete) ||
      a.itemsMissing - b.itemsMissing ||
      a.total - b.total,
  );

  const completeResults = withItems.filter((r) => r.isComplete);

  const winner = completeResults[0] ?? withItems[0] ?? null;
  if (winner) winner.isWinner = true;

  return {
    results: withItems,
    winner: winner ?? null,
    bestCompleteResult: completeResults[0] ?? null,
  };
}

/** Pontua um produto face a uma query normalizada (2 = match exato, 1 = parcial). */
export function searchScore(haystack: string, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;
  if (haystack.includes(normalizedQuery)) return 2;
  if (normalizedQuery.split(" ").some((t) => t.length > 1 && haystack.includes(t))) return 1;
  return -1; // sem match
}

/** Constroi um PriceDrop a partir do preco anterior e atual (ou null se nao desceu). */
export function buildDrop(
  product: ProductGlobal,
  supermarket: Supermarket,
  previousPrice: number,
  currentPrice: number,
): PriceDrop | null {
  if (previousPrice <= currentPrice) return null;
  return {
    product,
    supermarket,
    previousPrice,
    currentPrice,
    dropAbsolute: round2(previousPrice - currentPrice),
    dropPercent: round2(((previousPrice - currentPrice) / previousPrice) * 100),
  };
}

/**
 * Prepara um produto global canonico a partir de uma oferta em revisao.
 * Usado tanto pelo repositorio em memoria como pelo PostgreSQL para manter a
 * normalizacao de quantidade/EAN consistente.
 */
export function buildGlobalDraftFromMarketReview(
  market: ProductMarket,
  input: ReviewGlobalInput = {},
): Omit<ProductGlobal, "id"> {
  const nameGlobal = cleanText(input.nameGlobal) ?? market.nameMarket;
  const q = parseQuantity(nameGlobal);
  return {
    nameGlobal,
    brand: cleanText(input.brand),
    eanCode: cleanEan(input.eanCode ?? market.rawEan),
    categoryId: input.categoryId ?? null,
    imageUrl: cleanText(input.imageUrl) ?? market.imageUrl,
    quantityValue: q?.value ?? null,
    quantityUnit: q?.unit ?? null,
    baseUnit: q?.baseUnit ?? null,
    baseQuantity: q?.baseQuantity ?? null,
  };
}

// ── Navegacao por catalogo ───────────────────────────────────────────────────

export interface NormalizedBrowseParams {
  query: string;
  categoryId: number | null;
  supermarketSlug: string | null;
  onlyPromo: boolean;
  sort: BrowseSort;
  page: number;
  pageSize: number;
}

/** Aplica defaults e limites aos parametros de navegacao (partilhado pelas rotas). */
export function normalizeBrowseParams(params: BrowseParams = {}): NormalizedBrowseParams {
  const pageSizeRaw = Number(params.pageSize ?? BROWSE_DEFAULT_PAGE_SIZE);
  const pageRaw = Number(params.page ?? 1);
  const query = (params.query ?? "").trim();
  return {
    query,
    categoryId: Number.isInteger(params.categoryId) ? (params.categoryId as number) : null,
    supermarketSlug: params.supermarketSlug?.trim() || null,
    onlyPromo: params.onlyPromo === true,
    sort: params.sort ?? (query ? "relevance" : "cheapest"),
    page: Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1,
    pageSize: Number.isFinite(pageSizeRaw)
      ? Math.min(BROWSE_MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
      : BROWSE_DEFAULT_PAGE_SIZE,
  };
}

/** Filtro de catalogo aplicavel a um produto ja composto com ofertas. */
export function matchesBrowseFilters(
  item: ProductWithOffers,
  params: Pick<NormalizedBrowseParams, "categoryId" | "supermarketSlug" | "onlyPromo">,
): boolean {
  if (item.offers.length === 0) return false;
  if (params.categoryId != null && item.category?.id !== params.categoryId) return false;
  if (params.supermarketSlug && !item.offers.some((o) => o.supermarket.slug === params.supermarketSlug)) {
    return false;
  }
  if (params.onlyPromo && !item.offers.some((o) => o.hasPromo)) return false;
  return true;
}

/** Maior desconto percentual (promo vs. regular) entre as ofertas de um produto. */
export function bestPromoPercent(item: ProductWithOffers): number {
  let best = 0;
  for (const o of item.offers) {
    if (!o.hasPromo || o.pricePromo == null || o.priceRegular <= 0) continue;
    const pct = ((o.priceRegular - o.pricePromo) / o.priceRegular) * 100;
    if (pct > best) best = pct;
  }
  return round2(best);
}

/** Ordena produtos in-place segundo o criterio pedido (estavel por nome). */
export function sortProducts(
  items: ProductWithOffers[],
  sort: BrowseSort,
  relevance?: (item: ProductWithOffers) => number,
): ProductWithOffers[] {
  const byName = (a: ProductWithOffers, b: ProductWithOffers) =>
    a.product.nameGlobal.localeCompare(b.product.nameGlobal, "pt-PT");
  return items.sort((a, b) => {
    switch (sort) {
      case "cheapest":
        return (a.cheapestPrice ?? Infinity) - (b.cheapestPrice ?? Infinity) || byName(a, b);
      case "savings":
        return (b.savingsPercent ?? 0) - (a.savingsPercent ?? 0) || byName(a, b);
      case "promo":
        return bestPromoPercent(b) - bestPromoPercent(a) || byName(a, b);
      case "relevance":
        return relevance ? relevance(b) - relevance(a) || byName(a, b) : byName(a, b);
      case "name":
      default:
        return byName(a, b);
    }
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): {
  slice: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}

/** Pipeline completo (filtrar -> ordenar -> paginar) sobre uma lista em memoria. */
export function browseInMemory(
  candidates: ProductWithOffers[],
  params: NormalizedBrowseParams,
  relevance?: (item: ProductWithOffers) => number,
): BrowseResult {
  const filtered = candidates.filter((item) => matchesBrowseFilters(item, params));
  sortProducts(filtered, params.sort, relevance);
  const { slice, ...meta } = paginate(filtered, params.page, params.pageSize);
  return { items: slice, ...meta };
}

// ── Estatisticas ─────────────────────────────────────────────────────────────

/** Linha minima de "preco atual" usada para agregar rankings por supermercado. */
export interface CurrentPriceRow {
  productGlobalId: number;
  supermarketId: number;
  effectivePrice: number;
  hasPromo: boolean;
}

/**
 * Constroi o ranking de supermercados a partir dos precos atuais.
 * Considera apenas supermercados ativos e produtos com pelo menos uma oferta.
 */
export function summarizeSupermarkets(
  rows: CurrentPriceRow[],
  supermarkets: Supermarket[],
): SupermarketSummary[] {
  const active = supermarkets.filter((s) => s.isActive);
  const activeIds = new Set(active.map((s) => s.id));

  const byGlobal = new Map<number, CurrentPriceRow[]>();
  for (const r of rows) {
    if (!activeIds.has(r.supermarketId)) continue;
    const list = byGlobal.get(r.productGlobalId) ?? [];
    list.push(r);
    byGlobal.set(r.productGlobalId, list);
  }

  const acc = new Map<
    number,
    { offers: number; promos: number; cheapest: number; indexSum: number; indexCount: number }
  >();
  for (const s of active) acc.set(s.id, { offers: 0, promos: 0, cheapest: 0, indexSum: 0, indexCount: 0 });

  for (const offers of byGlobal.values()) {
    const min = Math.min(...offers.map((o) => o.effectivePrice));
    const avg = offers.reduce((sum, o) => sum + o.effectivePrice, 0) / offers.length;
    for (const o of offers) {
      const a = acc.get(o.supermarketId)!;
      a.offers++;
      if (o.hasPromo) a.promos++;
      if (o.effectivePrice === min) a.cheapest++;
      // O indice so faz sentido quando ha comparacao com outra loja.
      if (offers.length > 1 && avg > 0) {
        a.indexSum += (o.effectivePrice / avg) * 100;
        a.indexCount++;
      }
    }
  }

  return active
    .map((supermarket) => {
      const a = acc.get(supermarket.id)!;
      return {
        supermarket,
        offerCount: a.offers,
        promoCount: a.promos,
        cheapestCount: a.cheapest,
        cheapestShare: a.offers ? round2((a.cheapest / a.offers) * 100) : 0,
        priceIndex: a.indexCount ? round2(a.indexSum / a.indexCount) : null,
      };
    })
    .sort(
      (x, y) =>
        (x.priceIndex ?? Infinity) - (y.priceIndex ?? Infinity) ||
        y.cheapestShare - x.cheapestShare ||
        x.supermarket.name.localeCompare(y.supermarket.name, "pt-PT"),
    );
}

/** Melhor preco (minimo entre supermercados) em cada dia do historico. */
export function bestPriceSeries(points: HistoryPoint[]): { date: string; price: number }[] {
  const out: { date: string; price: number }[] = [];
  for (const p of points) {
    const values = Object.values(p.prices).filter((v): v is number => v != null);
    if (values.length) out.push({ date: p.date, price: Math.min(...values) });
  }
  return out;
}

/** Estatisticas (min/max/media/variacao) do melhor preco ao longo do periodo. */
export function computePriceStats(points: HistoryPoint[], days: number): PriceStats {
  const series = bestPriceSeries(points);
  if (series.length === 0) {
    return {
      days,
      current: null,
      min: null,
      max: null,
      avg: null,
      changeAbsolute: null,
      changePercent: null,
    };
  }
  const prices = series.map((s) => s.price);
  const first = prices[0];
  const current = prices[prices.length - 1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return {
    days,
    current: round2(current),
    min: round2(min),
    max: round2(max),
    avg: round2(avg),
    changeAbsolute: round2(current - first),
    changePercent: first > 0 ? round2(((current - first) / first) * 100) : null,
  };
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function cleanEan(ean: string | null | undefined): string | null {
  if (!ean) return null;
  const digits = ean.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}
