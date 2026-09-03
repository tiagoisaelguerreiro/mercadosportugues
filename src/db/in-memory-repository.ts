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
import { loadLiveCatalog, saveLiveCatalog, type LiveCatalog } from "@/db/live-catalog";
import { normalizeText } from "@/lib/parsing";
import { identityTokens, levenshtein } from "@/lib/matching";
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
  /** Indice invertido token -> IDs de produtos (para tolerancia a typos). */
  private tokenIndex = new Map<string, Set<number>>();
  private scrapeRuns: ScrapeRun[] = [];

  /** Catalogo em ficheiro que alimentou este repositorio (null em seed/testes). */
  private fileCatalog: LiveCatalog | null = null;

  constructor() {
    const live = loadLiveCatalog();
    this.fileCatalog = live;
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

    for (const g of this.globalById.values()) {
      for (const token of identityTokens(`${g.brand ?? ""} ${g.nameGlobal}`)) {
        const set = this.tokenIndex.get(token) ?? new Set<number>();
        set.add(g.id);
        this.tokenIndex.set(token, set);
      }
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
    const seen = new Set<number>();
    const push = (global: ProductGlobal, score: number) => {
      if (seen.has(global.id)) return;
      seen.add(global.id);
      const item = this.composeProduct(global);
      // Relevancia: token inteiro e prefixo valem mais que substring algures;
      // produtos comparados em mais lojas sobem (e o valor da plataforma).
      const tokens = new Set(identityTokens(`${global.brand ?? ""} ${global.nameGlobal}`));
      let relevance = score;
      for (const t of q.split(" ").filter((x) => x.length > 1)) {
        if (tokens.has(t)) relevance += 1.5;
        else if (t.length >= 3 && [...tokens].some((h) => h.startsWith(t))) relevance += 0.75;
      }
      relevance += Math.min(item.offers.length, 8) * 0.15;
      scored.push({ item, score: relevance });
    };

    for (const global of this.globalById.values()) {
      const haystack = normalizeText(`${global.brand ?? ""} ${global.nameGlobal}`);
      const score = q ? searchScore(haystack, q) : 0;
      if (score < 0) continue;
      push(global, score);
    }

    // Poucos resultados? Tenta typos (distancia de edicao por token) e
    // palavras coladas ("cocacola" -> "coca"+"cola").
    if (q && scored.length < Math.min(5, limit)) {
      for (const id of this.fuzzyTokenMatches(q, limit * 4)) {
        const global = this.globalById.get(id);
        if (global) push(global, 0.5);
      }
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

  /**
   * IDs de produtos cujos tokens estao a 1-2 edicoes dos tokens da query,
   * ou formados por colagem de dois tokens conhecidos. Ordenados por nº de
   * tokens coincidentes.
   */
  private fuzzyTokenMatches(query: string, cap: number): number[] {
    const hits = new Map<number, number>();
    const add = (id: number, weight: number) => hits.set(id, (hits.get(id) ?? 0) + weight);
    for (const qt of query.split(" ").filter((t) => t.length >= 3)) {
      // Primeiro palavras coladas ("cocacola" -> "coca"+"cola"): evidencia
      // mais forte que um typo e evita falsos positivos ("cacarola").
      if (qt.length >= 6) {
        let split = false;
        for (let i = 2; i <= qt.length - 2; i++) {
          const a = this.tokenIndex.get(qt.slice(0, i));
          const b = this.tokenIndex.get(qt.slice(i));
          if (a && b) {
            for (const id of a) add(id, 2);
            for (const id of b) add(id, 2);
            split = true;
            break;
          }
        }
        if (split) continue;
      }
      const maxDist = qt.length >= 7 ? 2 : 1;
      for (const [token, ids] of this.tokenIndex) {
        if (Math.abs(token.length - qt.length) > maxDist) continue;
        if (levenshtein(token, qt) <= maxDist) {
          for (const id of ids) add(id, 1);
        }
      }
    }
    return [...hits.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, cap)
      .map(([id]) => id);
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
      matchLocked: true,
    };
    this.marketById.set(productMarketId, updated);
    this.persistCatalog();
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
      matchLocked: true,
    };
    this.marketById.set(productMarketId, updated);
    this.persistCatalog();
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
      matchLocked: true,
    };
    this.marketById.set(productMarketId, updated);
    this.persistCatalog();
    return updated;
  }

  /**
   * Grava as decisoes do admin de volta no ficheiro (modo sem PostgreSQL).
   * Sem isto, approve/reject perdiam-se ao reiniciar e o rematch nao os via.
   * Em seed/testes (fileCatalog null) nao faz nada.
   */
  private persistCatalog(): void {
    if (!this.fileCatalog) return;
    this.fileCatalog.productsGlobal = [...this.globalById.values()];
    this.fileCatalog.productsMarket = [...this.marketById.values()];
    this.fileCatalog.scrapedAt = new Date().toISOString();
    saveLiveCatalog(this.fileCatalog);
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
