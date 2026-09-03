import type {
  Category,
  PricePoint,
  ProductGlobal,
  ProductMarket,
  ScrapeRun,
  Supermarket,
} from "@/lib/types";
import { computePricePerUnit, parseQuantity } from "@/lib/parsing";

export const supermarkets: Supermarket[] = [
  { id: 1, slug: "continente", name: "Continente", logoUrl: null, baseUrl: "https://www.continente.pt", colorHex: "#e2001a", isActive: true },
  { id: 2, slug: "pingo-doce", name: "Pingo Doce", logoUrl: null, baseUrl: "https://www.pingodoce.pt", colorHex: "#00843d", isActive: true },
  { id: 3, slug: "aldi", name: "Aldi", logoUrl: null, baseUrl: "https://www.aldi.pt", colorHex: "#001e64", isActive: true },
  { id: 4, slug: "intermarche", name: "Intermarché", logoUrl: null, baseUrl: "https://www.intermarche.pt", colorHex: "#ef6c00", isActive: true },
  { id: 5, slug: "lidl", name: "Lidl", logoUrl: null, baseUrl: "https://www.lidl.pt", colorHex: "#0050aa", isActive: true },
  { id: 6, slug: "auchan", name: "Auchan", logoUrl: null, baseUrl: "https://www.auchan.pt", colorHex: "#d2123c", isActive: true },
  // A insignia Minipreco foi absorvida pela Auchan (aquisicao concluida em 2024,
  // conversao das lojas terminada em 2025). Mantem-se para preservar historico,
  // mas inativa: nao entra em comparacoes nem em rankings.
  { id: 7, slug: "minipreco", name: "Minipreço", logoUrl: null, baseUrl: "https://www.auchan.pt", colorHex: "#e30613", isActive: false },
  { id: 8, slug: "mercadona", name: "Mercadona", logoUrl: null, baseUrl: "https://www.mercadona.pt", colorHex: "#00a650", isActive: true },
];

export const categories: Category[] = [
  { id: 1, parentId: null, name: "Mercearia", slug: "mercearia" },
  { id: 2, parentId: null, name: "Laticínios e Ovos", slug: "laticinios-ovos" },
  { id: 3, parentId: null, name: "Bebidas", slug: "bebidas" },
  { id: 4, parentId: null, name: "Limpeza", slug: "limpeza" },
];

interface SeedProduct {
  id: number;
  nameGlobal: string;
  brand: string;
  ean: string;
  categoryId: number;
  imageUrl: string | null;
  // preco por supermercado: [supermarketId, precoRegular, precoPromo|null]
  offers: [number, number, number | null][];
}

const SEED: SeedProduct[] = [
  {
    id: 1,
    nameGlobal: "Leite UHT Meio Gordo 1L",
    brand: "Mimosa",
    ean: "5601010000017",
    categoryId: 2,
    imageUrl: null,
    offers: [
      [1, 0.95, 0.89],
      [2, 0.92, null],
      [3, 0.85, null],
      [4, 0.94, null],
      [5, 0.86, null],
      [6, 0.93, 0.9],
      [7, 0.88, null],
      [8, 0.84, null],
    ],
  },
  {
    id: 2,
    nameGlobal: "Arroz Agulha 1kg",
    brand: "Cigala",
    ean: "5601010000024",
    categoryId: 1,
    imageUrl: null,
    offers: [
      [1, 1.49, null],
      [2, 1.45, 1.29],
      [3, 1.19, null],
      [4, 1.39, null],
      [5, 1.25, null],
      [6, 1.42, null],
      [7, 1.35, 1.22],
      [8, 1.24, null],
    ],
  },
  {
    id: 3,
    nameGlobal: "Coca-Cola Original 1.5L",
    brand: "Coca-Cola",
    ean: "5449000000996",
    categoryId: 3,
    imageUrl: null,
    offers: [
      [1, 1.99, 1.79],
      [2, 1.95, null],
      [3, 1.85, null],
      [4, 2.05, 1.75],
      [6, 1.98, null],
      [7, 1.92, null],
      [8, 1.89, null],
    ],
  },
  {
    id: 4,
    nameGlobal: "Azeite Virgem Extra 750ml",
    brand: "Gallo",
    ean: "5601010000048",
    categoryId: 1,
    imageUrl: null,
    offers: [
      [1, 6.99, 5.99],
      [2, 6.89, null],
      [4, 6.95, null],
      [5, 5.79, null],
      [6, 6.79, null],
      [8, 6.15, 5.85],
    ],
  },
  {
    id: 5,
    nameGlobal: "Manteiga com Sal 250g",
    brand: "Mimosa",
    ean: "5601010000055",
    categoryId: 2,
    imageUrl: null,
    offers: [
      [1, 2.29, null],
      [2, 2.19, 1.99],
      [3, 1.89, null],
      [6, 2.25, null],
      [7, 2.09, 1.95],
    ],
  },
  {
    id: 6,
    nameGlobal: "Esparguete 500g",
    brand: "Milaneza",
    ean: "5601010000062",
    categoryId: 1,
    imageUrl: null,
    offers: [
      [1, 0.99, null],
      [2, 0.95, null],
      [3, 0.79, null],
      [4, 0.92, 0.79],
      [5, 0.82, null],
      [6, 0.97, null],
      [8, 0.85, null],
    ],
  },
  {
    id: 7,
    nameGlobal: "Ovos Classe M 6 un",
    brand: "Continente",
    ean: "5601010000079",
    categoryId: 2,
    imageUrl: null,
    offers: [
      [1, 1.39, null],
      [2, 1.45, null],
      [3, 1.19, null],
      [6, 1.42, 1.29],
      [7, 1.32, null],
      [8, 1.29, null],
    ],
  },
  {
    id: 8,
    nameGlobal: "Detergente Roupa Líquido 1.5L",
    brand: "Skip",
    ean: "5601010000086",
    categoryId: 4,
    imageUrl: null,
    offers: [
      [1, 7.99, 6.49],
      [2, 7.79, null],
      [4, 7.89, null],
      [5, 6.29, null],
      [6, 7.69, 6.99],
    ],
  },
  {
    id: 9,
    nameGlobal: "Água Mineral 6x1.5L",
    brand: "Luso",
    ean: "5601010000093",
    categoryId: 3,
    imageUrl: null,
    offers: [
      [1, 2.49, null],
      [2, 2.45, 2.19],
      [3, 1.99, null],
      [4, 2.39, null],
      [5, 2.05, null],
      [6, 2.42, null],
      [8, 2.15, null],
    ],
  },
  {
    id: 10,
    nameGlobal: "Iogurte Natural 4x125g",
    brand: "Continente",
    ean: "5601010000109",
    categoryId: 2,
    imageUrl: null,
    offers: [
      [1, 1.19, null],
      [3, 0.99, null],
      [5, 1.05, null],
      [6, 1.15, 0.99],
      [7, 1.09, null],
    ],
  },
  {
    id: 11,
    nameGlobal: "Café Moído 250g",
    brand: "Delta",
    ean: "5601010000116",
    categoryId: 1,
    imageUrl: null,
    offers: [
      [1, 2.99, 2.49],
      [2, 2.89, null],
      [4, 2.95, null],
      [6, 2.85, null],
    ],
  },
  {
    id: 12,
    nameGlobal: "Cerveja 6x33cl",
    brand: "Super Bock",
    ean: "5601010000123",
    categoryId: 3,
    imageUrl: null,
    offers: [
      [1, 3.49, null],
      [2, 3.39, 2.99],
      [3, 2.89, null],
      [5, 2.95, null],
      [6, 3.42, null],
      [7, 3.29, 2.89],
      [8, 3.15, null],
    ],
  },
];

// ── Derivacao das tabelas relacionais a partir do seed ───────────────────────

export const productsGlobal: ProductGlobal[] = SEED.map((s) => {
  const q = parseQuantity(s.nameGlobal);
  return {
    id: s.id,
    nameGlobal: s.nameGlobal,
    brand: s.brand,
    eanCode: s.ean,
    categoryId: s.categoryId,
    imageUrl: s.imageUrl,
    quantityValue: q?.value ?? null,
    quantityUnit: q?.unit ?? null,
    baseUnit: q?.baseUnit ?? null,
    baseQuantity: q?.baseQuantity ?? null,
  };
});

export const productsMarket: ProductMarket[] = [];
const todayPrices: PricePoint[] = [];

let pmId = 1;
for (const s of SEED) {
  const q = parseQuantity(s.nameGlobal);
  for (const [supermarketId, regular, promo] of s.offers) {
    const effective = promo ?? regular;
    const ppu = computePricePerUnit(effective, q);
    productsMarket.push({
      id: pmId,
      productGlobalId: s.id,
      supermarketId,
      marketSku: `${supermarketId}-${s.id}`,
      nameMarket: `${s.brand} ${s.nameGlobal}`,
      productUrl: `${supermarkets.find((m) => m.id === supermarketId)!.baseUrl}/produto/${s.id}`,
      imageUrl: s.imageUrl,
      rawEan: s.ean,
      matchStatus: "matched",
      matchConfidence: 1,
      lastSeenAt: new Date().toISOString(),
    });
    todayPrices.push({
      productMarketId: pmId,
      priceRegular: regular,
      pricePromo: promo,
      hasPromo: promo != null,
      pricePerUnit: ppu?.value ?? null,
      pricePerUnitUom: ppu?.uom ?? null,
      capturedAt: isoDate(0),
    });
    pmId++;
  }
}

/**
 * Gera 365 dias de historico como uma recolha diaria realista: o preco fica
 * igual varios dias (patamar semanal) e so muda quando ha atualizacao de
 * etiqueta ou uma semana de promocao. O dia 0 (hoje) usa os precos exatos do
 * seed; o dia 1 (ontem) usa o regular se hoje estiver em promo, para as
 * "maiores descidas" terem um salto visivel.
 */
export const HISTORY_DAYS = 365;

export const priceHistory: PricePoint[] = (() => {
  const out: PricePoint[] = [];
  for (const today of todayPrices) {
    for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
      if (daysAgo === 0) {
        out.push(today);
        continue;
      }
      if (daysAgo === 1 && today.pricePromo != null) {
        out.push({
          productMarketId: today.productMarketId,
          priceRegular: today.priceRegular,
          pricePromo: null,
          hasPromo: false,
          pricePerUnit: null,
          pricePerUnitUom: null,
          capturedAt: isoDate(1),
        });
        continue;
      }
      const week = Math.floor(daysAgo / 7);
      const seasonal = Math.sin((week / 52) * 2 * Math.PI) * 0.03;
      const step = Math.sin(today.productMarketId * 1.31 + week * 0.45) * 0.025;
      const drift = daysAgo * 0.00022;
      const regular = round2(Math.max(0.1, today.priceRegular * (1 + seasonal + step + drift)));
      const promoWeek = (today.productMarketId + week) % 6 === 0;
      const promo = promoWeek ? round2(regular * 0.88) : null;
      out.push({
        productMarketId: today.productMarketId,
        priceRegular: regular,
        pricePromo: promo,
        hasPromo: promo != null,
        pricePerUnit: null,
        pricePerUnitUom: null,
        capturedAt: isoDate(daysAgo),
      });
    }
  }
  return out;
})();

/**
 * Historico de execucoes do pipeline (ultimos 7 dias) para o painel admin em
 * modo demo. Os supermercados com adapter automatico sao os que correm todos os
 * dias; os restantes sao alimentados manualmente/por importacao.
 */
export const SCRAPED_SUPERMARKET_IDS = [1, 2, 6];

export const scrapeRuns: ScrapeRun[] = (() => {
  const out: ScrapeRun[] = [];
  let id = 1;
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    for (const supermarketId of SCRAPED_SUPERMARKET_IDS) {
      const supermarket = supermarkets.find((s) => s.id === supermarketId)!;
      const offers = productsMarket.filter((m) => m.supermarketId === supermarketId).length;
      const started = new Date(`${isoDate(daysAgo)}T04:00:00.000Z`);
      const failed = daysAgo === 3 && supermarketId === 2; // exemplo de falha transitoria
      const durationMs = 40_000 + supermarketId * 9_000 + daysAgo * 1_500;
      out.push({
        id: id++,
        supermarketId,
        supermarketSlug: supermarket.slug,
        startedAt: started.toISOString(),
        finishedAt: new Date(started.getTime() + durationMs).toISOString(),
        status: failed ? "failed" : "success",
        productsReceived: failed ? 0 : offers,
        newMarketProducts: daysAgo === 6 ? offers : 0,
        pricePoints: failed ? 0 : offers,
        matched: failed ? 0 : offers,
        review: 0,
        orphan: 0,
        dryRun: false,
        errorMessage: failed ? "HTTP 503 em /home/produtos/mercearia apos 4 tentativas" : null,
      });
    }
  }
  return out.reverse();
})();

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
