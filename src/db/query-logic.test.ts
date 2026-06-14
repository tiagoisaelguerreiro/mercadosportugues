import { describe, expect, it } from "vitest";
import {
  buildDrop,
  buildOffers,
  computeBasket,
  effectivePrice,
  searchScore,
  toProductWithOffers,
} from "@/db/query-logic";
import { downsample } from "@/db/repository-types";
import type { HistoryPoint, PricePoint, ProductGlobal, ProductMarket, Supermarket } from "@/lib/types";

const SM: Supermarket[] = [
  { id: 1, slug: "continente", name: "Continente", logoUrl: null, baseUrl: "x", colorHex: null, isActive: true },
  { id: 2, slug: "pingo-doce", name: "Pingo Doce", logoUrl: null, baseUrl: "x", colorHex: null, isActive: true },
  { id: 3, slug: "aldi", name: "Aldi", logoUrl: null, baseUrl: "x", colorHex: null, isActive: false },
];
const smMap = new Map(SM.map((s) => [s.id, s]));

function market(id: number, supermarketId: number): ProductMarket {
  return {
    id,
    productGlobalId: 1,
    supermarketId,
    marketSku: `${supermarketId}-1`,
    nameMarket: "X",
    productUrl: null,
    imageUrl: null,
    rawEan: null,
    matchStatus: "matched",
    matchConfidence: 1,
    lastSeenAt: null,
  };
}

function price(productMarketId: number, regular: number, promo: number | null = null): PricePoint {
  return {
    productMarketId,
    priceRegular: regular,
    pricePromo: promo,
    hasPromo: promo != null,
    pricePerUnit: null,
    pricePerUnitUom: null,
    capturedAt: "2025-01-01",
  };
}

describe("effectivePrice", () => {
  it("usa promo quando existe", () => {
    expect(effectivePrice({ priceRegular: 2, pricePromo: 1.5 })).toBe(1.5);
    expect(effectivePrice({ priceRegular: 2, pricePromo: null })).toBe(2);
  });
});

describe("buildOffers", () => {
  it("ordena do mais barato ao mais caro e marca o mais barato", () => {
    const markets = [market(10, 1), market(20, 2)];
    const latest = new Map([
      [10, price(10, 1.0)],
      [20, price(20, 0.8)],
    ]);
    const offers = buildOffers(markets, latest, smMap);
    expect(offers.map((o) => o.supermarket.slug)).toEqual(["pingo-doce", "continente"]);
    expect(offers[0].isCheapest).toBe(true);
    expect(offers[1].isCheapest).toBe(false);
  });

  it("ignora supermercados inativos", () => {
    const markets = [market(30, 3)]; // aldi inativo
    const latest = new Map([[30, price(30, 0.5)]]);
    expect(buildOffers(markets, latest, smMap)).toHaveLength(0);
  });

  it("marca empates como ambos cheapest", () => {
    const markets = [market(10, 1), market(20, 2)];
    const latest = new Map([
      [10, price(10, 1.0)],
      [20, price(20, 1.0)],
    ]);
    const offers = buildOffers(markets, latest, smMap);
    expect(offers.every((o) => o.isCheapest)).toBe(true);
  });
});

describe("toProductWithOffers", () => {
  const global: ProductGlobal = {
    id: 1,
    nameGlobal: "Leite 1L",
    brand: "Mimosa",
    eanCode: null,
    categoryId: null,
    imageUrl: null,
    quantityValue: 1,
    quantityUnit: "L",
    baseUnit: "L",
    baseQuantity: 1,
  };

  it("calcula poupanca absoluta e percentual", () => {
    const markets = [market(10, 1), market(20, 2)];
    const latest = new Map([
      [10, price(10, 1.0)],
      [20, price(20, 0.8)],
    ]);
    const offers = buildOffers(markets, latest, smMap);
    const result = toProductWithOffers(global, offers, null);
    expect(result.cheapestPrice).toBe(0.8);
    expect(result.priciestPrice).toBe(1.0);
    expect(result.savingsAbsolute).toBe(0.2);
    expect(result.savingsPercent).toBe(20);
  });

  it("sem ofertas devolve nulos", () => {
    const result = toProductWithOffers(global, [], null);
    expect(result.cheapestPrice).toBeNull();
    expect(result.savingsAbsolute).toBeNull();
  });
});

describe("computeBasket", () => {
  const names = new Map([
    [1, "Leite"],
    [2, "Arroz"],
  ]);
  // Continente tem ambos; Pingo Doce so tem o leite.
  const prices: Record<string, number> = {
    "1:1": 1.0,
    "2:1": 1.5,
    "1:2": 0.9,
  };
  const lookup = (g: number, s: number) => prices[`${g}:${s}`] ?? null;

  it("elege o mais barato que tem o carrinho completo", () => {
    const result = computeBasket(
      [
        { productGlobalId: 1, quantity: 1 },
        { productGlobalId: 2, quantity: 1 },
      ],
      SM,
      names,
      lookup,
    );
    // Continente: 2.5 (completo). Pingo Doce: 0.9 (incompleto, falta arroz).
    expect(result.winner?.supermarket.slug).toBe("continente");
    expect(result.winner?.isComplete).toBe(true);
    expect(result.bestCompleteResult?.total).toBe(2.5);
  });

  it("respeita a quantidade", () => {
    const result = computeBasket([{ productGlobalId: 1, quantity: 3 }], SM, names, lookup);
    const continente = result.results.find((r) => r.supermarket.slug === "continente");
    expect(continente?.total).toBe(3.0);
  });

  it("marca itens em falta", () => {
    const result = computeBasket(
      [
        { productGlobalId: 1, quantity: 1 },
        { productGlobalId: 2, quantity: 1 },
      ],
      SM,
      names,
      lookup,
    );
    const pingo = result.results.find((r) => r.supermarket.slug === "pingo-doce");
    expect(pingo?.itemsMissing).toBe(1);
    expect(pingo?.missingProductIds).toEqual([2]);
    expect(pingo?.isComplete).toBe(false);
  });

  it("se ninguem tem tudo, vence o mais barato entre os com mais itens", () => {
    const result = computeBasket([{ productGlobalId: 2, quantity: 1 }], SM, names, lookup);
    // So o Continente tem arroz.
    expect(result.winner?.supermarket.slug).toBe("continente");
    expect(result.bestCompleteResult?.supermarket.slug).toBe("continente");
  });
});

describe("searchScore", () => {
  it("match exato pontua 2", () => {
    expect(searchScore("leite mimosa meio gordo", "leite")).toBe(2);
  });
  it("match parcial por token pontua 1", () => {
    expect(searchScore("arroz agulha cigala", "cigala basmati")).toBe(1);
  });
  it("sem match devolve -1", () => {
    expect(searchScore("arroz agulha", "detergente")).toBe(-1);
  });
});

describe("buildDrop", () => {
  const g = { id: 1 } as ProductGlobal;
  const s = SM[0];
  it("calcula descida", () => {
    expect(buildDrop(g, s, 2.0, 1.5)).toMatchObject({ dropAbsolute: 0.5, dropPercent: 25 });
  });
  it("null quando nao desceu", () => {
    expect(buildDrop(g, s, 1.5, 1.5)).toBeNull();
    expect(buildDrop(g, s, 1.0, 1.5)).toBeNull();
  });
});

describe("downsample", () => {
  const points: HistoryPoint[] = Array.from({ length: 365 }, (_, i) => ({
    date: `2025-${String((i % 12) + 1).padStart(2, "0")}-01`,
    prices: { continente: i },
  }));

  it("nao altera series curtas", () => {
    const short = points.slice(0, 30);
    expect(downsample(short, 90)).toHaveLength(30);
  });

  it("reduz series longas ao maximo", () => {
    expect(downsample(points, 90)).toHaveLength(90);
  });

  it("preserva primeiro e ultimo ponto", () => {
    const out = downsample(points, 90);
    expect(out[0]).toBe(points[0]);
    expect(out[out.length - 1]).toBe(points[points.length - 1]);
  });
});
