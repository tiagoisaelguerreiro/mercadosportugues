import type {
  BasketComparison,
  BasketLine,
  BasketSupermarketResult,
  Category,
  HistoryPoint,
  MarketOffer,
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

/**
 * Repositorio em memoria com toda a logica de consulta da plataforma.
 *
 * Esta camada e propositadamente agnostica da origem dos dados: hoje le do
 * seed; trocar para PostgreSQL implica reimplementar os mesmos metodos com
 * queries SQL (ver db/schema.sql e a materialized view latest_prices), sem
 * tocar na API nem no frontend.
 */
class InMemoryRepository {
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

    // Indexa historico e calcula o preco mais recente por oferta.
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

  getSupermarkets(): Supermarket[] {
    return [...this.supermarketsById.values()];
  }

  getCategories(): Category[] {
    return [...this.categoriesById.values()];
  }

  private effectivePrice(point: PricePoint): number {
    return point.pricePromo ?? point.priceRegular;
  }

  /** Constroi as ofertas (uma por supermercado) para um produto global. */
  private offersForGlobal(globalId: number): MarketOffer[] {
    const markets = [...this.marketById.values()].filter(
      (m) => m.productGlobalId === globalId,
    );
    const offers: MarketOffer[] = [];
    for (const m of markets) {
      const latest = this.latestByMarket.get(m.id);
      if (!latest) continue;
      const supermarket = this.supermarketsById.get(m.supermarketId);
      if (!supermarket || !supermarket.isActive) continue;
      offers.push({
        supermarket,
        productMarketId: m.id,
        effectivePrice: this.effectivePrice(latest),
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
    offers.sort((a, b) => a.effectivePrice - b.effectivePrice);
    if (offers.length > 0) {
      const min = offers[0].effectivePrice;
      for (const o of offers) o.isCheapest = o.effectivePrice === min;
    }
    return offers;
  }

  private toProductWithOffers(global: ProductGlobal): ProductWithOffers {
    const offers = this.offersForGlobal(global.id);
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
      category: global.categoryId ? this.categoriesById.get(global.categoryId) ?? null : null,
      offers,
      cheapestPrice: cheapest,
      priciestPrice: priciest,
      savingsAbsolute,
      savingsPercent,
    };
  }

  getProduct(globalId: number): ProductWithOffers | null {
    const global = this.globalById.get(globalId);
    return global ? this.toProductWithOffers(global) : null;
  }

  /** Pesquisa por nome/marca; ordena ofertas do mais barato ao mais caro. */
  search(query: string, limit = 30): ProductWithOffers[] {
    const q = normalizeText(query);
    const results: { item: ProductWithOffers; score: number }[] = [];
    for (const global of this.globalById.values()) {
      const haystack = normalizeText(`${global.brand ?? ""} ${global.nameGlobal}`);
      if (!q) {
        results.push({ item: this.toProductWithOffers(global), score: 0 });
        continue;
      }
      if (haystack.includes(q)) {
        results.push({ item: this.toProductWithOffers(global), score: 2 });
      } else if (q.split(" ").some((token) => token.length > 1 && haystack.includes(token))) {
        results.push({ item: this.toProductWithOffers(global), score: 1 });
      }
    }
    return results
      .sort((a, b) => b.score - a.score || a.item.product.nameGlobal.localeCompare(b.item.product.nameGlobal))
      .slice(0, limit)
      .map((r) => r.item);
  }

  /** Historico dos ultimos N dias agregado por supermercado (para grafico). */
  getHistory(globalId: number, days = 30): { supermarkets: Supermarket[]; points: HistoryPoint[] } {
    const markets = [...this.marketById.values()].filter((m) => m.productGlobalId === globalId);
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
        row[supermarket.slug] = this.effectivePrice(p);
        byDate.set(p.capturedAt, row);
      }
    }

    const points: HistoryPoint[] = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, prices]) => ({ date, prices }));

    return { supermarkets: [...involved.values()], points: downsample(points, 90) };
  }

  /** As maiores descidas de preco entre o penultimo e o ultimo registo. */
  biggestDrops(limit = 8): PriceDrop[] {
    const drops: PriceDrop[] = [];
    for (const m of this.marketById.values()) {
      const points = this.historyByMarket.get(m.id);
      if (!points || points.length < 2) continue;
      const current = points[points.length - 1];
      const previous = points[points.length - 2];
      const cur = this.effectivePrice(current);
      const prev = this.effectivePrice(previous);
      if (prev <= cur) continue;
      const global = m.productGlobalId ? this.globalById.get(m.productGlobalId) : null;
      const supermarket = this.supermarketsById.get(m.supermarketId);
      if (!global || !supermarket) continue;
      drops.push({
        product: global,
        supermarket,
        previousPrice: prev,
        currentPrice: cur,
        dropAbsolute: round2(prev - cur),
        dropPercent: round2(((prev - cur) / prev) * 100),
      });
    }
    return drops.sort((a, b) => b.dropPercent - a.dropPercent).slice(0, limit);
  }

  /** Compara o custo de um carrinho em cada supermercado. */
  compareBasket(lines: BasketLine[]): BasketComparison {
    const supermarkets = this.getSupermarkets().filter((s) => s.isActive);
    const results: BasketSupermarketResult[] = supermarkets.map((supermarket) => {
      let total = 0;
      let available = 0;
      let missing = 0;
      const missingProductIds: number[] = [];
      const resultLines: BasketSupermarketResult["lines"] = [];

      for (const line of lines) {
        const global = this.globalById.get(line.productGlobalId);
        const qty = Math.max(1, Math.floor(line.quantity || 1));
        const market = [...this.marketById.values()].find(
          (m) => m.productGlobalId === line.productGlobalId && m.supermarketId === supermarket.id,
        );
        const latest = market ? this.latestByMarket.get(market.id) : undefined;
        if (market && latest) {
          const unitPrice = this.effectivePrice(latest);
          const lineTotal = round2(unitPrice * qty);
          total = round2(total + lineTotal);
          available++;
          resultLines.push({
            productGlobalId: line.productGlobalId,
            productName: global?.nameGlobal ?? `#${line.productGlobalId}`,
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
            productName: global?.nameGlobal ?? `#${line.productGlobalId}`,
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

    // Considera apenas supermercados com pelo menos um item.
    const withItems = results.filter((r) => r.itemsAvailable > 0);
    withItems.sort((a, b) => a.total - b.total);

    const completeResults = withItems.filter((r) => r.isComplete);
    completeResults.sort((a, b) => a.total - b.total);

    // Vencedor preferencial: o mais barato que tem TODOS os itens.
    const winner = completeResults[0] ?? withItems[0] ?? null;
    if (winner) {
      const target = results.find((r) => r.supermarket.id === winner.supermarket.id);
      if (target) target.isWinner = true;
    }

    return {
      results: withItems,
      winner: winner ?? null,
      bestCompleteResult: completeResults[0] ?? null,
    };
  }
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Reduz uma série temporal a no máximo `maxPoints`, amostrando a intervalos
 * regulares e preservando sempre o primeiro e o último ponto. Mantém o gráfico
 * legível em períodos longos (ex.: 1 ano) sem perder a tendência.
 */
function downsample(points: HistoryPoint[], maxPoints: number): HistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  // Garante o último ponto exato (preço de hoje).
  if (out[out.length - 1] !== points[points.length - 1]) {
    out[out.length - 1] = points[points.length - 1];
  }
  return out;
}

// Singleton — reutilizado entre pedidos no mesmo processo.
let instance: InMemoryRepository | null = null;

export function getRepository(): InMemoryRepository {
  if (!instance) instance = new InMemoryRepository();
  return instance;
}

export type Repository = InMemoryRepository;
