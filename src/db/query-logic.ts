import type {
  BasketComparison,
  BasketLine,
  BasketSupermarketResult,
  Category,
  MarketOffer,
  PriceDrop,
  PricePoint,
  ProductGlobal,
  ProductMarket,
  ProductWithOffers,
  Supermarket,
} from "@/lib/types";
import { round2 } from "@/db/repository-types";

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
  offers.sort((a, b) => a.effectivePrice - b.effectivePrice);
  if (offers.length > 0) {
    const min = offers[0].effectivePrice;
    for (const o of offers) o.isCheapest = o.effectivePrice === min;
  }
  return offers;
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
  withItems.sort((a, b) => a.total - b.total);

  const completeResults = withItems.filter((r) => r.isComplete);
  completeResults.sort((a, b) => a.total - b.total);

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
