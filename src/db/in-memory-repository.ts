import type {
  BasketComparison,
  BasketLine,
  Category,
  HistoryPoint,
  PriceDrop,
  PricePoint,
  ProductGlobal,
  ProductMarket,
  ProductWithOffers,
  Supermarket,
} from "@/lib/types";
import {
  categories as seedCategories,
  priceHistory as seedHistory,
  productsGlobal as seedGlobal,
  productsMarket as seedMarket,
  supermarkets as seedSupermarkets,
} from "@/db/seed-data";
import { normalizeText } from "@/lib/parsing";
import { downsample, type HistoryResult, type Repository } from "@/db/repository-types";
import {
  buildDrop,
  buildOffers,
  computeBasket,
  effectivePrice,
  searchScore,
  toProductWithOffers,
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

  constructor() {
    for (const s of seedSupermarkets) this.supermarketsById.set(s.id, s);
    for (const c of seedCategories) this.categoriesById.set(c.id, c);
    for (const g of seedGlobal) this.globalById.set(g.id, g);
    for (const m of seedMarket) this.marketById.set(m.id, m);

    for (const point of seedHistory) {
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
      if (!supermarket) continue;
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
      if (!global || !supermarket) continue;
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
}
