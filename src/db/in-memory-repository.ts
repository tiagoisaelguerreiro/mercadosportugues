import type {
  BasketComparison,
  BasketLine,
  BrowseParams,
  BrowseResult,
  Category,
  HistoryPoint,
  PlatformStats,
  PriceDrop,
  PricePoint,
  ProductGlobal,
  ProductMarket,
  ProductWithOffers,
  ReviewGlobalInput,
  ReviewMatch,
  ScrapeRun,
  Supermarket,
  SupermarketSummary,
} from "@/lib/types";
import {
  categories as seedCategories,
  priceHistory as seedHistory,
  productsGlobal as seedGlobal,
  productsMarket as seedMarket,
  scrapeRuns as seedScrapeRuns,
  supermarkets as seedSupermarkets,
} from "@/db/seed-data";
import { loadLiveCatalog } from "@/db/live-catalog";
import { normalizeText } from "@/lib/parsing";
import { downsample, type HistoryResult, type Repository } from "@/db/repository-types";
import {
  browseInMemory,
  buildDrop,
  buildOffers,
  buildGlobalDraftFromMarketReview,
  computeBasket,
  effectivePrice,
  normalizeBrowseParams,
  searchScore,
  summarizeSupermarkets,
  toProductWithOffers,
  type CurrentPriceRow,
} from "@/db/query-logic";

/**
 * Repositorio em memoria alimentado pelos dados seed. Implementa o mesmo
 * contrato `Repository` que a versao PostgreSQL, partilhando a logica de
 * dominio em query-logic.ts. Usado por defeito quando USE_DB != "true".
 */
export class InMemoryRepository implements Repository {
  private supermarketsById = new Map<number, Supermarket>();
  private categoriesById = new Map<number, Category>();
  private globalById = new Map<number, ProductGlobal>();
  private marketById = new Map<number, ProductMarket>();
  private latestByMarket = new Map<number, PricePoint>();
  private historyByMarket = new Map<number, PricePoint[]>();
  private scrapeRuns: ScrapeRun[] = [];

  constructor() {
    const live = loadLiveCatalog();
    const globals = live?.productsGlobal?.length ? live.productsGlobal : seedGlobal;
    const markets = live?.productsGlobal?.length ? live.productsMarket : seedMarket;
    const history = live?.productsGlobal?.length ? live.priceHistory : seedHistory;
    this.scrapeRuns = live?.scrapeRuns?.length ? live.scrapeRuns : seedScrapeRuns;

    for (const s of seedSupermarkets) this.supermarketsById.set(s.id, s);
    if (live?.productsMarket?.length) {
      const seen = new Set(live.productsMarket.map((m) => m.supermarketId));
      for (const s of this.supermarketsById.values()) {
        if (s.isActive && !seen.has(s.id)) {
          this.supermarketsById.set(s.id, { ...s, isActive: false });
        }
      }
    }
    for (const c of seedCategories) this.categoriesById.set(c.id, c);
    for (const g of globals) this.globalById.set(g.id, g);
    for (const m of markets) this.marketById.set(m.id, m);
    if (!live?.productsGlobal?.length) this.seedReviewMarketProduct();

    for (const point of history) {
      const list = this.historyByMarket.get(point.productMarketId) ?? [];
      list.push(point);
      this.historyByMarket.set(point.productMarketId, list);
    }
    for (const [marketId, points] of this.historyByMarket) {
      points.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      this.latestByMarket.set(marketId, points[points.length - 1]);
    }
  }

  private marketsForGlobal(globalId: number): ProductMarket[] {
    return [...this.marketById.values()].filter((m) => m.productGlobalId === globalId);
  }

  private categoryFor(global: ProductGlobal): Category | null {
    return global.categoryId ? this.categoriesById.get(global.categoryId) ?? null : null;
  }

  private seedReviewMarketProduct(): void {
    const nextId = Math.max(0, ...this.marketById.keys()) + 1;
    this.marketById.set(nextId, {
      id: nextId,
      productGlobalId: 2,
      supermarketId: 2,
      marketSku: "review-pd-arroz-carolino-1kg",
      nameMarket: "Arroz Carolino Pingo Doce 1 kg",
      productUrl: "https://www.pingodoce.pt/produto/review-arroz-carolino",
      imageUrl: null,
      rawEan: null,
      matchStatus: "review",
      matchConfidence: 0.86,
      lastSeenAt: new Date().toISOString(),
    });
  }

  private composeProduct(global: ProductGlobal): ProductWithOffers {
    const offers = buildOffers(
      this.marketsForGlobal(global.id),
      this.latestByMarket,
      this.supermarketsById,
    );
    return toProductWithOffers(global, offers, this.categoryFor(global));
  }

  async getSupermarkets(): Promise<Supermarket[]> {
    return [...this.supermarketsById.values()];
  }

  async getCategories(): Promise<Category[]> {
    return [...this.categoriesById.values()];
  }

  async getProduct(globalId: number): Promise<ProductWithOffers | null> {
    const global = this.globalById.get(globalId);
    return global ? this.composeProduct(global) : null;
  }

  async search(query: string, limit = 30): Promise<ProductWithOffers[]> {
    const q = normalizeText(query);
    const scored: { item: ProductWithOffers; score: number }[] = [];
    for (const global of this.globalById.values()) {
      const haystack = normalizeText(`${global.brand ?? ""} ${global.nameGlobal}`);
      const score = q ? searchScore(haystack, q) : 0;
      if (score < 0) continue;
      scored.push({ item: this.composeProduct(global), score });
    }
    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.item.product.nameGlobal.localeCompare(b.item.product.nameGlobal),
      )
      .slice(0, limit)
      .map((r) => r.item);
  }

  async browse(params: BrowseParams = {}): Promise<BrowseResult> {
    const p = normalizeBrowseParams(params);
    const q = normalizeText(p.query);
    const scores = new Map<number, number>();
    const candidates: ProductWithOffers[] = [];

    for (const global of this.globalById.values()) {
      if (q) {
        const haystack = normalizeText(`${global.brand ?? ""} ${global.nameGlobal}`);
        const score = searchScore(haystack, q);
        if (score < 0) continue;
        scores.set(global.id, score);
      }
      candidates.push(this.composeProduct(global));
    }

    return browseInMemory(candidates, p, (item) => scores.get(item.product.id) ?? 0);
  }

  async listProductIds(limit = 20_000): Promise<number[]> {
    const withOffers = new Set<number>();
    for (const m of this.marketById.values()) {
      if (m.productGlobalId != null) withOffers.add(m.productGlobalId);
    }
    return [...withOffers]
      .filter((id) => this.globalById.has(id))
      .sort((a, b) => a - b)
      .slice(0, Math.max(1, limit));
  }

  async getStats(): Promise<PlatformStats> {
    let offerCount = 0;
    let promoCount = 0;
    let lastCapturedAt: string | null = null;
    const productsWithOffers = new Set<number>();

    for (const m of this.marketById.values()) {
      const supermarket = this.supermarketsById.get(m.supermarketId);
      const latest = this.latestByMarket.get(m.id);
      if (!supermarket?.isActive || !latest || m.productGlobalId == null) continue;
      offerCount++;
      if (latest.hasPromo) promoCount++;
      productsWithOffers.add(m.productGlobalId);
      if (!lastCapturedAt || latest.capturedAt > lastCapturedAt) lastCapturedAt = latest.capturedAt;
    }

    return {
      productCount: productsWithOffers.size,
      offerCount,
      promoCount,
      activeSupermarkets: [...this.supermarketsById.values()].filter((s) => s.isActive).length,
      categoryCount: this.categoriesById.size,
      lastCapturedAt,
    };
  }

  async getSupermarketSummaries(): Promise<SupermarketSummary[]> {
    const rows: CurrentPriceRow[] = [];
    for (const m of this.marketById.values()) {
      const latest = this.latestByMarket.get(m.id);
      if (!latest || m.productGlobalId == null) continue;
      rows.push({
        productGlobalId: m.productGlobalId,
        supermarketId: m.supermarketId,
        effectivePrice: effectivePrice(latest),
        hasPromo: latest.hasPromo,
      });
    }
    return summarizeSupermarkets(rows, [...this.supermarketsById.values()]);
  }

  async listScrapeRuns(limit = 50): Promise<ScrapeRun[]> {
    return [...this.scrapeRuns]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, clampLimit(limit));
  }

  async getHistory(globalId: number, days = 30): Promise<HistoryResult> {
    const markets = this.marketsForGlobal(globalId);
    const involved = new Map<number, Supermarket>();
    const byDate = new Map<string, Record<string, number | null>>();

    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    for (const m of markets) {
      const supermarket = this.supermarketsById.get(m.supermarketId);
      if (!supermarket?.isActive) continue;
      const points = (this.historyByMarket.get(m.id) ?? []).filter(
        (p) => p.capturedAt >= cutoffIso,
      );
      if (points.length) involved.set(supermarket.id, supermarket);
      for (const p of points) {
        const row = byDate.get(p.capturedAt) ?? {};
        row[supermarket.slug] = effectivePrice(p);
        byDate.set(p.capturedAt, row);
      }
    }

    const points: HistoryPoint[] = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, prices]) => ({ date, prices }));

    return { supermarkets: [...involved.values()], points: downsample(points, 90) };
  }

  async biggestDrops(limit = 8): Promise<PriceDrop[]> {
    const drops: PriceDrop[] = [];
    for (const m of this.marketById.values()) {
      const points = this.historyByMarket.get(m.id);
      if (!points || points.length < 2) continue;
      const current = points[points.length - 1];
      const previous = points[points.length - 2];
      const global = m.productGlobalId ? this.globalById.get(m.productGlobalId) : null;
      const supermarket = this.supermarketsById.get(m.supermarketId);
      if (!global || !supermarket?.isActive) continue;
      const drop = buildDrop(
        global,
        supermarket,
        effectivePrice(previous),
        effectivePrice(current),
      );
      if (drop) drops.push(drop);
    }
    return drops.sort((a, b) => b.dropPercent - a.dropPercent).slice(0, limit);
  }

  async compareBasket(lines: BasketLine[]): Promise<BasketComparison> {
    const productNameById = new Map<number, string>();
    for (const g of this.globalById.values()) productNameById.set(g.id, g.nameGlobal);

    // Index preco efetivo por (globalId, supermarketId).
    const priceByKey = new Map<string, number>();
    for (const m of this.marketById.values()) {
      if (m.productGlobalId == null) continue;
      const latest = this.latestByMarket.get(m.id);
      if (!latest) continue;
      priceByKey.set(`${m.productGlobalId}:${m.supermarketId}`, effectivePrice(latest));
    }

    return computeBasket(
      lines,
      [...this.supermarketsById.values()],
      productNameById,
      (productGlobalId, supermarketId) =>
        priceByKey.get(`${productGlobalId}:${supermarketId}`) ?? null,
    );
  }

  async listReviewMatches(limit = 50): Promise<ReviewMatch[]> {
    return [...this.marketById.values()]
      .filter((m) => m.matchStatus === "review")
      .sort((a, b) => (b.matchConfidence ?? 0) - (a.matchConfidence ?? 0))
      .slice(0, clampLimit(limit))
      .map((m) => this.composeReviewMatch(m))
      .filter((m): m is ReviewMatch => m != null);
  }

  async approveReviewMatch(
    productMarketId: number,
    productGlobalId?: number,
  ): Promise<ProductMarket | null> {
    const market = this.marketById.get(productMarketId);
    if (!market) return null;
    const targetGlobalId = productGlobalId ?? market.productGlobalId;
    if (targetGlobalId == null || !this.globalById.has(targetGlobalId)) return null;

    const updated: ProductMarket = {
      ...market,
      productGlobalId: targetGlobalId,
      matchStatus: "matched",
      matchConfidence: 1,
    };
    this.marketById.set(productMarketId, updated);
    return updated;
  }

  async rejectReviewMatch(productMarketId: number): Promise<ProductMarket | null> {
    const market = this.marketById.get(productMarketId);
    if (!market) return null;

    const updated: ProductMarket = {
      ...market,
      productGlobalId: null,
      matchStatus: "orphan",
      matchConfidence: null,
    };
    this.marketById.set(productMarketId, updated);
    return updated;
  }

  async createGlobalFromReview(
    productMarketId: number,
    input: ReviewGlobalInput = {},
  ): Promise<ProductMarket | null> {
    const market = this.marketById.get(productMarketId);
    if (!market) return null;

    const draft = buildGlobalDraftFromMarketReview(market, input);
    const existingByEan = draft.eanCode
      ? [...this.globalById.values()].find((g) => g.eanCode === draft.eanCode)
      : null;
    if (existingByEan) {
      return this.approveReviewMatch(productMarketId, existingByEan.id);
    }

    const global: ProductGlobal = {
      id: Math.max(0, ...this.globalById.keys()) + 1,
      ...draft,
    };
    this.globalById.set(global.id, global);

    const updated: ProductMarket = {
      ...market,
      productGlobalId: global.id,
      matchStatus: "orphan",
      matchConfidence: null,
    };
    this.marketById.set(productMarketId, updated);
    return updated;
  }

  private composeReviewMatch(market: ProductMarket): ReviewMatch | null {
    const supermarket = this.supermarketsById.get(market.supermarketId);
    if (!supermarket) return null;
    return {
      productMarket: market,
      supermarket,
      suggestedProduct: market.productGlobalId
        ? this.globalById.get(market.productGlobalId) ?? null
        : null,
    };
  }
}

function clampLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 50;
}
