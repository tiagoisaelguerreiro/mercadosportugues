import type { RawProduct, ScrapeRunInput } from "@/lib/types";

/**
 * Camada de persistencia do pipeline.
 *
 * A implementacao real escreve em PostgreSQL com a seguinte logica idempotente:
 *
 *   1. UPSERT em `products_market` por (supermarket_id, market_sku):
 *        - cria a oferta se nao existir;
 *        - atualiza nome/url/imagem/raw_ean e last_seen_at.
 *
 *   2. Corre o matching (ver src/lib/matching.ts) para ofertas `pending`:
 *        - EAN -> products_global existente, ou
 *        - fuzzy + veto de tamanho -> matched/review/orphan.
 *        - orphan cria um novo products_global.
 *
 *   3. INSERT em `price_history` por (product_market_id, captured_at)
 *      com ON CONFLICT DO UPDATE (re-correr no mesmo dia nao duplica).
 *
 *   4. ensure_price_partition(CURRENT_DATE) antes do passo 3.
 *
 *   5. REFRESH MATERIALIZED VIEW CONCURRENTLY latest_prices.
 *
 *   6. Regista cada execucao por adapter em `scrape_runs` (observabilidade).
 *
 * Esta interface mantem o orquestrador agnostico do destino (DB real vs
 * dry-run em ficheiro/memoria).
 */
export interface PriceSink {
  persistBatch(supermarketId: number, products: RawProduct[]): Promise<PersistResult>;
  /** Regista o resultado da execucao de um adapter (sucesso ou falha). */
  recordRun(run: ScrapeRunInput): Promise<void>;
  finalize(): Promise<void>;
}

export interface PersistResult {
  received: number;
  newMarketProducts: number;
  pricePoints: number;
  /** Desagregacao do matching neste lote. */
  matched: number;
  review: number;
  orphan: number;
}

export const EMPTY_PERSIST_RESULT: PersistResult = {
  received: 0,
  newMarketProducts: 0,
  pricePoints: 0,
  matched: 0,
  review: 0,
  orphan: 0,
};

export function addPersistResults(a: PersistResult, b: PersistResult): PersistResult {
  return {
    received: a.received + b.received,
    newMarketProducts: a.newMarketProducts + b.newMarketProducts,
    pricePoints: a.pricePoints + b.pricePoints,
    matched: a.matched + b.matched,
    review: a.review + b.review,
    orphan: a.orphan + b.orphan,
  };
}

/**
 * Sink de dry-run: nao escreve em DB, apenas agrega contagens e (opcionalmente)
 * imprime uma amostra. Usado por defeito quando USE_DB != "true".
 */
export class DryRunSink implements PriceSink {
  private readonly captured: RawProduct[] = [];
  private readonly runs: ScrapeRunInput[] = [];

  async persistBatch(_supermarketId: number, products: RawProduct[]): Promise<PersistResult> {
    this.captured.push(...products);
    return {
      received: products.length,
      newMarketProducts: products.length,
      pricePoints: products.length,
      matched: 0,
      review: 0,
      orphan: products.length,
    };
  }

  async recordRun(run: ScrapeRunInput): Promise<void> {
    this.runs.push(run);
  }

  getRuns(): ScrapeRunInput[] {
    return this.runs;
  }

  async finalize(): Promise<void> {
    const sample = this.captured.slice(0, 5);
    console.log(`\n[dry-run] ${this.captured.length} produtos capturados. Amostra:`);
    for (const p of sample) {
      const price = p.hasPromo ? `${p.pricePromo} (era ${p.priceRegular})` : `${p.priceRegular}`;
      const ppu = p.pricePerUnit ? ` | ${p.pricePerUnit} €/${p.pricePerUnitUom}` : "";
      console.log(`  - ${p.name} [${p.ean ?? "sem EAN"}] -> ${price} €${ppu}`);
    }
  }

  getCaptured(): RawProduct[] {
    return this.captured;
  }
}
