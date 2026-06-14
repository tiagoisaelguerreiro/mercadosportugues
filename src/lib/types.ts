// Tipos de dominio partilhados entre scraper, API e frontend.

export type BaseUnit = "kg" | "L" | "un";
export type QuantityUnit = "kg" | "g" | "L" | "ml" | "cl" | "un";

export interface Supermarket {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  baseUrl: string;
  colorHex: string | null;
  isActive: boolean;
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
}

/** Quantidade normalizada extraida do nome de um produto. */
export interface ParsedQuantity {
  value: number; // valor original (ex.: 500)
  unit: QuantityUnit; // unidade original (ex.: "g")
  baseUnit: BaseUnit; // unidade base normalizada (ex.: "kg")
  baseQuantity: number; // valor convertido para a base (ex.: 0.5)
}

export interface ProductGlobal {
  id: number;
  nameGlobal: string;
  brand: string | null;
  eanCode: string | null;
  categoryId: number | null;
  imageUrl: string | null;
  quantityValue: number | null;
  quantityUnit: QuantityUnit | null;
  baseUnit: BaseUnit | null;
  baseQuantity: number | null;
}

export type MatchStatus = "pending" | "matched" | "review" | "orphan";

export interface ProductMarket {
  id: number;
  productGlobalId: number | null;
  supermarketId: number;
  marketSku: string;
  nameMarket: string;
  productUrl: string | null;
  imageUrl: string | null;
  rawEan: string | null;
  matchStatus: MatchStatus;
  matchConfidence: number | null;
  lastSeenAt: string | null;
}

export interface PricePoint {
  productMarketId: number;
  priceRegular: number;
  pricePromo: number | null;
  hasPromo: boolean;
  pricePerUnit: number | null;
  pricePerUnitUom: BaseUnit | null;
  capturedAt: string; // ISO date (YYYY-MM-DD)
}

/** Resultado bruto produzido por um adapter de scraping. */
export interface RawProduct {
  marketSku: string;
  name: string;
  brand: string | null;
  ean: string | null;
  priceRegular: number;
  pricePromo: number | null;
  hasPromo: boolean;
  pricePerUnit: number | null;
  pricePerUnitUom: BaseUnit | null;
  imageUrl: string | null;
  productUrl: string | null;
  categoryPath: string | null;
}

// ── Formas usadas pela API/frontend ──────────────────────────────────────────

/** Preco atual de um produto num supermercado especifico. */
export interface MarketOffer {
  supermarket: Supermarket;
  productMarketId: number;
  effectivePrice: number;
  priceRegular: number;
  pricePromo: number | null;
  hasPromo: boolean;
  pricePerUnit: number | null;
  pricePerUnitUom: BaseUnit | null;
  productUrl: string | null;
  capturedAt: string;
  isCheapest: boolean;
}

/** Produto global com todas as ofertas, ordenadas do mais barato ao mais caro. */
export interface ProductWithOffers {
  product: ProductGlobal;
  category: Category | null;
  offers: MarketOffer[];
  cheapestPrice: number | null;
  priciestPrice: number | null;
  savingsAbsolute: number | null; // diferenca entre o mais caro e o mais barato
  savingsPercent: number | null;
}

export interface PriceDrop {
  product: ProductGlobal;
  supermarket: Supermarket;
  previousPrice: number;
  currentPrice: number;
  dropAbsolute: number;
  dropPercent: number;
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  prices: Record<string, number | null>; // chave = slug do supermercado
}

export interface BasketLine {
  productGlobalId: number;
  quantity: number;
}

export interface BasketSupermarketResult {
  supermarket: Supermarket;
  total: number;
  itemsAvailable: number;
  itemsMissing: number;
  missingProductIds: number[];
  lines: {
    productGlobalId: number;
    productName: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    available: boolean;
  }[];
  isComplete: boolean;
  isWinner: boolean;
}

export interface BasketComparison {
  results: BasketSupermarketResult[];
  winner: BasketSupermarketResult | null;
  bestCompleteResult: BasketSupermarketResult | null;
}
