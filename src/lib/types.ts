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
  /** Marca tal como veio da loja (nao misturar com o produto global). */
  brandMarket?: string | null;
  matchStatus: MatchStatus;
  matchConfidence: number | null;
  /** Decisao manual do admin (approve/reject): o relink nao altera esta oferta. */
  matchLocked?: boolean;
  lastSeenAt: string | null;
}

export interface ReviewMatch {
  productMarket: ProductMarket;
  supermarket: Supermarket;
  suggestedProduct: ProductGlobal | null;
}

export interface ReviewGlobalInput {
  nameGlobal?: string;
  brand?: string | null;
  eanCode?: string | null;
  categoryId?: number | null;
  imageUrl?: string | null;
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

// ── Navegacao por catalogo (filtros + paginacao) ─────────────────────────────

export type BrowseSort = "relevance" | "cheapest" | "savings" | "promo" | "name";

export interface BrowseParams {
  query?: string;
  categoryId?: number | null;
  supermarketSlug?: string | null;
  onlyPromo?: boolean;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
}

export interface BrowseResult {
  items: ProductWithOffers[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Estatisticas da plataforma ───────────────────────────────────────────────

/** Numeros agregados usados na home, em /sobre e em /api/stats. */
export interface PlatformStats {
  productCount: number;
  offerCount: number;
  promoCount: number;
  activeSupermarkets: number;
  categoryCount: number;
  /** Data (YYYY-MM-DD) da captura de precos mais recente, ou null sem dados. */
  lastCapturedAt: string | null;
}

/** Resumo comparativo de um supermercado face aos restantes. */
export interface SupermarketSummary {
  supermarket: Supermarket;
  offerCount: number;
  promoCount: number;
  /** Numero de produtos em que pratica o preco mais baixo (empates contam). */
  cheapestCount: number;
  /** Percentagem (0..100) das suas ofertas em que e o mais barato. */
  cheapestShare: number;
  /**
   * Indice de preco medio: 100 = media dos supermercados para os mesmos
   * produtos; abaixo de 100 e mais barato que a media. null sem dados.
   */
  priceIndex: number | null;
}

/** Estatisticas do historico de um produto num periodo. */
export interface PriceStats {
  days: number;
  current: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  /** Variacao do melhor preco entre o inicio e o fim do periodo. */
  changeAbsolute: number | null;
  changePercent: number | null;
}

// ── Observabilidade do scraping ──────────────────────────────────────────────

export type ScrapeRunStatus = "running" | "success" | "failed";

export interface ScrapeRun {
  id: number;
  supermarketId: number;
  supermarketSlug: string;
  startedAt: string; // ISO datetime
  finishedAt: string | null;
  status: ScrapeRunStatus;
  productsReceived: number;
  newMarketProducts: number;
  pricePoints: number;
  matched: number;
  review: number;
  orphan: number;
  dryRun: boolean;
  errorMessage: string | null;
}

export type ScrapeRunInput = Omit<ScrapeRun, "id">;
