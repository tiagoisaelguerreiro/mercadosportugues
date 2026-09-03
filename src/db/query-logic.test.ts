import { describe, expect, it } from "vitest";
import {
  bestPromoPercent,
  browseInMemory,
  buildDrop,
  buildGlobalDraftFromMarketReview,
  buildOffers,
  computeBasket,
  computePriceStats,
  effectivePrice,
  normalizeBrowseParams,
  paginate,
  searchScore,
  sortProducts,
  summarizeSupermarkets,
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

  it("fica com uma oferta por supermercado (a mais barata)", () => {
    const markets = [market(10, 1), { ...market(11, 1), marketSku: "1-2" }, market(20, 2)];
    const latest = new Map([
      [10, price(10, 1.9)],
      [11, price(11, 0.9)],
      [20, price(20, 1.2)],
    ]);
    const offers = buildOffers(markets, latest, smMap);
    expect(offers).toHaveLength(2);
    expect(offers.map((o) => [o.supermarket.slug, o.effectivePrice])).toEqual([
      ["continente", 0.9],
      ["pingo-doce", 1.2],
    ]);
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

describe("buildGlobalDraftFromMarketReview", () => {
  it("normaliza quantidade e EAN a partir de uma oferta em revisao", () => {
    const draft = buildGlobalDraftFromMarketReview(
      {
        ...market(99, 2),
        nameMarket: "Leite Meio Gordo Pingo Doce 1 L",
        rawEan: "EAN 5601010000017",
        imageUrl: "https://example.test/leite.png",
        matchStatus: "review",
        matchConfidence: 0.86,
      },
      { brand: "Pingo Doce" },
    );

    expect(draft).toMatchObject({
      nameGlobal: "Leite Meio Gordo Pingo Doce 1 L",
      brand: "Pingo Doce",
      eanCode: "5601010000017",
      quantityValue: 1,
      quantityUnit: "L",
      baseUnit: "L",
      baseQuantity: 1,
    });
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

describe("normalizeBrowseParams", () => {
  it("aplica defaults e limites", () => {
    const p = normalizeBrowseParams({});
    expect(p).toMatchObject({ page: 1, pageSize: 24, sort: "cheapest", onlyPromo: false });
    expect(normalizeBrowseParams({ page: -3, pageSize: 999 })).toMatchObject({ page: 1, pageSize: 60 });
    expect(normalizeBrowseParams({ query: " leite " }).sort).toBe("relevance");
    expect(normalizeBrowseParams({ categoryId: 2.5 }).categoryId).toBeNull();
  });
});

describe("paginate", () => {
  it("divide em paginas e clampa a pagina pedida", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(items, 1, 10)).toMatchObject({ total: 23, totalPages: 3, page: 1 });
    expect(paginate(items, 3, 10).slice).toEqual([20, 21, 22]);
    expect(paginate(items, 50, 10).page).toBe(3);
    expect(paginate([], 1, 10)).toMatchObject({ total: 0, totalPages: 1, slice: [] });
  });
});

describe("sortProducts / browseInMemory", () => {
  const g = (id: number, name: string): ProductGlobal => ({
    id,
    nameGlobal: name,
    brand: null,
    eanCode: null,
    categoryId: id % 2 === 0 ? 2 : 1,
    imageUrl: null,
    quantityValue: null,
    quantityUnit: null,
    baseUnit: null,
    baseQuantity: null,
  });
  const cat = (id: number) => ({ id, parentId: null, name: `C${id}`, slug: `c${id}` });
  const withOffers = (id: number, name: string, prices: [number, number | null][]) => {
    const markets = prices.map(([, ], i) => ({ ...market(id * 10 + i, i + 1), productGlobalId: id }));
    const latest = new Map(prices.map(([reg, promo], i) => [id * 10 + i, price(id * 10 + i, reg, promo)]));
    return toProductWithOffers(g(id, name), buildOffers(markets, latest, smMap), cat(id % 2 === 0 ? 2 : 1));
  };

  const items = [
    withOffers(1, "Zebra", [[2.0, null], [1.0, null]]),   // cheapest 1.0, savings 50%
    withOffers(2, "Arroz", [[1.5, 1.2], [1.6, null]]),    // promo 20%
    withOffers(3, "Massa", [[0.9, null]]),                 // single offer
  ];

  it("ordena por preco, poupanca, promocao e nome", () => {
    expect(sortProducts([...items], "cheapest").map((i) => i.product.id)).toEqual([3, 1, 2]);
    expect(sortProducts([...items], "savings").map((i) => i.product.id)).toEqual([1, 2, 3]);
    expect(sortProducts([...items], "promo").map((i) => i.product.id)).toEqual([2, 3, 1]);
    expect(sortProducts([...items], "name").map((i) => i.product.id)).toEqual([2, 3, 1]);
  });

  it("calcula o melhor desconto percentual", () => {
    expect(bestPromoPercent(items[1])).toBe(20);
    expect(bestPromoPercent(items[0])).toBe(0);
  });

  it("filtra por categoria, supermercado e promocao antes de paginar", () => {
    const params = normalizeBrowseParams({ categoryId: 1, pageSize: 10 });
    const byCategory = browseInMemory(items, params);
    expect(byCategory.items.map((i) => i.product.id)).toEqual([3, 1]);

    const onlyPromo = browseInMemory(items, normalizeBrowseParams({ onlyPromo: true }));
    expect(onlyPromo.items.map((i) => i.product.id)).toEqual([2]);

    const pingo = browseInMemory(items, normalizeBrowseParams({ supermarketSlug: "pingo-doce" }));
    expect(pingo.items.map((i) => i.product.id).sort()).toEqual([1, 2]);
    expect(pingo.total).toBe(2);
  });
});

describe("summarizeSupermarkets", () => {
  it("conta ofertas, promocoes, vezes mais barato e indice de preco", () => {
    const rows = [
      { productGlobalId: 1, supermarketId: 1, effectivePrice: 1.0, hasPromo: false },
      { productGlobalId: 1, supermarketId: 2, effectivePrice: 2.0, hasPromo: true },
      { productGlobalId: 2, supermarketId: 1, effectivePrice: 3.0, hasPromo: false },
      { productGlobalId: 2, supermarketId: 2, effectivePrice: 3.0, hasPromo: false },
      // supermercado inativo: ignorado
      { productGlobalId: 1, supermarketId: 3, effectivePrice: 0.1, hasPromo: false },
    ];
    const out = summarizeSupermarkets(rows, SM);
    expect(out).toHaveLength(2);
    const [first, second] = out;
    expect(first.supermarket.id).toBe(1);
    expect(first).toMatchObject({ offerCount: 2, promoCount: 0, cheapestCount: 2, cheapestShare: 100 });
    // produto 1: 1.0 vs media 1.5 -> 66.67; produto 2: 3.0 vs 3.0 -> 100 => media 83.33
    expect(first.priceIndex).toBeCloseTo(83.33, 1);
    expect(second).toMatchObject({ offerCount: 2, promoCount: 1, cheapestCount: 1, cheapestShare: 50 });
    expect(second.priceIndex).toBeCloseTo(116.67, 1);
  });

  it("devolve indice null sem dados comparaveis", () => {
    const out = summarizeSupermarkets(
      [{ productGlobalId: 1, supermarketId: 1, effectivePrice: 1, hasPromo: false }],
      SM,
    );
    expect(out.find((s) => s.supermarket.id === 1)?.priceIndex).toBeNull();
    expect(out.find((s) => s.supermarket.id === 2)?.offerCount).toBe(0);
  });
});

describe("computePriceStats", () => {
  const pts: HistoryPoint[] = [
    { date: "2025-01-01", prices: { a: 2.0, b: 1.8 } },
    { date: "2025-01-02", prices: { a: 1.9, b: null } },
    { date: "2025-01-03", prices: { a: 2.2, b: 1.5 } },
  ];

  it("usa o melhor preco diario para min/max/media/variacao", () => {
    const s = computePriceStats(pts, 30);
    expect(s).toMatchObject({ days: 30, current: 1.5, min: 1.5, max: 1.9 });
    expect(s.avg).toBeCloseTo(1.73, 2);
    expect(s.changeAbsolute).toBeCloseTo(-0.3, 2);
    expect(s.changePercent).toBeCloseTo(-16.67, 1);
  });

  it("devolve nulls sem historico", () => {
    expect(computePriceStats([], 7)).toMatchObject({ current: null, min: null, avg: null });
  });
});
