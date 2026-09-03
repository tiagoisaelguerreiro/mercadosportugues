import { sql } from "drizzle-orm";
import type { ProductGlobal, RawProduct, ScrapeRunInput } from "@/lib/types";
import { getDb, getPool } from "../../db/client";
import { productsGlobal, productsMarket, priceHistory, scrapeRuns } from "../../db/schema";
import { parseQuantity } from "../../lib/parsing";
import {
  DEFAULT_THRESHOLDS,
  matchProduct,
  type MatchCandidate,
} from "../../lib/matching";
import type { PersistResult, PriceSink } from "./persistence";

/**
 * Sink que persiste em PostgreSQL, de forma idempotente:
 *
 *   1. UPSERT em products_market por (supermarket_id, market_sku).
 *   2. Matching da oferta a um products_global (EAN -> fuzzy + veto de tamanho).
 *      - matched/review ligam a um global existente;
 *      - orphan cria um novo global.
 *   3. INSERT em price_history por (product_market_id, captured_at) com
 *      ON CONFLICT DO UPDATE (re-correr no mesmo dia atualiza, nao duplica).
 *   4. No finalize(): garante a particao do mes e REFRESH da materialized view.
 *
 * Carrega os candidatos globais uma vez em memoria (para projetos com dezenas de
 * milhares de produtos isto e aceitavel; acima disso, filtrar por trigram no DB).
 */
export class PostgresSink implements PriceSink {
  private db = getDb();
  private candidates: MatchCandidate[] = [];
  private candidatesByEan = new Map<string, ProductGlobal>();
  private loaded = false;
  private today = new Date().toISOString().slice(0, 10);
  private stats = {
    received: 0,
    newMarketProducts: 0,
    pricePoints: 0,
    newGlobals: 0,
    matched: 0,
    review: 0,
    orphan: 0,
  };

  private async ensureCandidates(): Promise<void> {
    if (this.loaded) return;
    const rows = await this.db.select().from(productsGlobal);
    for (const r of rows) {
      const g = toGlobal(r);
      this.candidates.push(g);
      if (g.eanCode) this.candidatesByEan.set(g.eanCode, g);
    }
    this.loaded = true;
  }

  async persistBatch(supermarketId: number, products: RawProduct[]): Promise<PersistResult> {
    await this.ensureCandidates();
    let newMarket = 0;
    let points = 0;
    const byStatus = { matched: 0, review: 0, orphan: 0 };

    for (const raw of products) {
      this.stats.received++;

      // 2) Matching -> global id
      const outcome = matchProduct(
        { name: raw.name, ean: raw.ean, brand: raw.brand, productUrl: raw.productUrl },
        this.candidates,
        (ean) => this.candidatesByEan.get(ean),
        DEFAULT_THRESHOLDS,
      );
      byStatus[outcome.status]++;

      let globalId: number;
      if (outcome.globalId != null) {
        globalId = outcome.globalId;
      } else {
        globalId = await this.createGlobal(raw);
      }

      // 1) UPSERT da oferta de mercado
      const [marketRow] = await this.db
        .insert(productsMarket)
        .values({
          productGlobalId: globalId,
          supermarketId,
          marketSku: raw.marketSku,
          nameMarket: raw.name,
          productUrl: raw.productUrl,
          imageUrl: raw.imageUrl,
          rawEan: raw.ean,
          matchStatus: outcome.status,
          matchConfidence: outcome.confidence,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [productsMarket.supermarketId, productsMarket.marketSku],
          set: {
            productGlobalId: globalId,
            nameMarket: raw.name,
            productUrl: raw.productUrl,
            imageUrl: raw.imageUrl,
            rawEan: raw.ean,
            matchStatus: outcome.status,
            matchConfidence: outcome.confidence,
            lastSeenAt: new Date(),
          },
        })
        .returning({ id: productsMarket.id, createdAt: productsMarket.createdAt });

      const isNew =
        marketRow.createdAt != null &&
        Date.now() - new Date(marketRow.createdAt).getTime() < 5000;
      if (isNew) newMarket++;

      // 3) INSERT do preco do dia (idempotente)
      await this.db
        .insert(priceHistory)
        .values({
          productMarketId: marketRow.id,
          priceRegular: String(raw.priceRegular),
          pricePromo: raw.pricePromo != null ? String(raw.pricePromo) : null,
          hasPromo: raw.hasPromo,
          pricePerUnit: raw.pricePerUnit != null ? String(raw.pricePerUnit) : null,
          pricePerUnitUom: raw.pricePerUnitUom,
          capturedAt: this.today,
        })
        .onConflictDoUpdate({
          target: [priceHistory.productMarketId, priceHistory.capturedAt],
          set: {
            priceRegular: String(raw.priceRegular),
            pricePromo: raw.pricePromo != null ? String(raw.pricePromo) : null,
            hasPromo: raw.hasPromo,
            pricePerUnit: raw.pricePerUnit != null ? String(raw.pricePerUnit) : null,
            pricePerUnitUom: raw.pricePerUnitUom,
          },
        });
      points++;
    }

    this.stats.newMarketProducts += newMarket;
    this.stats.pricePoints += points;
    this.stats.matched += byStatus.matched;
    this.stats.review += byStatus.review;
    this.stats.orphan += byStatus.orphan;
    return {
      received: products.length,
      newMarketProducts: newMarket,
      pricePoints: points,
      ...byStatus,
    };
  }

  async recordRun(run: ScrapeRunInput): Promise<void> {
    await this.db.insert(scrapeRuns).values({
      supermarketId: run.supermarketId,
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      status: run.status,
      productsReceived: run.productsReceived,
      newMarketProducts: run.newMarketProducts,
      pricePoints: run.pricePoints,
      matchedCount: run.matched,
      reviewCount: run.review,
      orphanCount: run.orphan,
      dryRun: run.dryRun,
      errorMessage: run.errorMessage,
    });
  }

  private async createGlobal(raw: RawProduct): Promise<number> {
    const q = parseQuantity(raw.name);
    const [row] = await this.db
      .insert(productsGlobal)
      .values({
        nameGlobal: raw.name,
        brand: raw.brand,
        eanCode: raw.ean,
        imageUrl: raw.imageUrl,
        quantityValue: q ? String(q.value) : null,
        quantityUnit: q?.unit ?? null,
        baseUnit: q?.baseUnit ?? null,
        baseQuantity: q ? String(q.baseQuantity) : null,
      })
      // Se o EAN ja existir (corrida), reutiliza em vez de falhar.
      .onConflictDoUpdate({
        target: productsGlobal.eanCode,
        set: { nameGlobal: raw.name },
      })
      .returning({ id: productsGlobal.id });

    const created: MatchCandidate = {
      id: row.id,
      nameGlobal: raw.name,
      brand: raw.brand ?? null,
      eanCode: raw.ean ?? null,
      categoryId: null,
      imageUrl: raw.imageUrl ?? null,
      quantityValue: q?.value ?? null,
      quantityUnit: q?.unit ?? null,
      baseUnit: q?.baseUnit ?? null,
      baseQuantity: q?.baseQuantity ?? null,
    };
    this.candidates.push(created);
    if (created.eanCode) this.candidatesByEan.set(created.eanCode, created);
    this.stats.newGlobals++;
    return row.id;
  }

  async finalize(): Promise<void> {
    // Garante a particao do mes corrente e atualiza a materialized view.
    await this.db.execute(sql`SELECT ensure_price_partition(CURRENT_DATE)`);
    try {
      await this.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY latest_prices`);
    } catch {
      // CONCURRENTLY exige indice unico + dados; faz fallback na 1.a execucao.
      await this.db.execute(sql`REFRESH MATERIALIZED VIEW latest_prices`);
    }
    console.log(
      `\n[postgres] recebidos=${this.stats.received} novas_ofertas=${this.stats.newMarketProducts} ` +
        `precos=${this.stats.pricePoints} novos_globais=${this.stats.newGlobals} ` +
        `matched=${this.stats.matched} review=${this.stats.review} orphan=${this.stats.orphan}`,
    );
    await getPool().end();
  }
}

function toGlobal(r: typeof productsGlobal.$inferSelect): MatchCandidate {
  return {
    id: r.id,
    nameGlobal: r.nameGlobal,
    brand: r.brand ?? null,
    eanCode: r.eanCode ?? null,
    categoryId: r.categoryId ?? null,
    imageUrl: r.imageUrl ?? null,
    quantityValue: r.quantityValue != null ? Number(r.quantityValue) : null,
    quantityUnit: (r.quantityUnit as ProductGlobal["quantityUnit"]) ?? null,
    baseUnit: (r.baseUnit as ProductGlobal["baseUnit"]) ?? null,
    baseQuantity: r.baseQuantity != null ? Number(r.baseQuantity) : null,
  };
}
