import type { ProductGlobal, RawProduct, ScrapeRun, ScrapeRunInput } from "@/lib/types";
import { parseQuantity } from "@/lib/parsing";
import {
  DEFAULT_THRESHOLDS,
  matchProduct,
  type MatchCandidate,
} from "@/lib/matching";
import {
  guessCategoryId,
  loadLiveCatalog,
  saveLiveCatalog,
  type LiveCatalog,
} from "@/db/live-catalog";
import type { PersistResult, PriceSink } from "./persistence";

/**
 * Persistencia local em JSON para maquinas sem PostgreSQL.
 * Idempotente no dia: re-correr o scraper atualiza precos e fotos.
 */
export class FileCatalogSink implements PriceSink {
  private catalog: LiveCatalog;
  private candidates: MatchCandidate[] = [];
  private candidatesByEan = new Map<string, ProductGlobal>();
  private today = new Date().toISOString().slice(0, 10);
  private nextGlobalId: number;
  private nextMarketId: number;
  private nextRunId: number;
  private stats = { received: 0, newMarketProducts: 0, pricePoints: 0, matched: 0, review: 0, orphan: 0 };

  constructor() {
    this.catalog = loadLiveCatalog() ?? {
      version: 1,
      scrapedAt: new Date().toISOString(),
      productsGlobal: [],
      productsMarket: [],
      priceHistory: [],
      scrapeRuns: [],
    };
    this.nextGlobalId = maxId(this.catalog.productsGlobal) + 1;
    this.nextMarketId = maxId(this.catalog.productsMarket) + 1;
    this.nextRunId = maxId(this.catalog.scrapeRuns) + 1;
    for (const global of this.catalog.productsGlobal) {
      this.candidates.push(global);
      if (global.eanCode) this.candidatesByEan.set(global.eanCode, global);
    }
  }

  async persistBatch(supermarketId: number, products: RawProduct[]): Promise<PersistResult> {
    const byStatus = { matched: 0, review: 0, orphan: 0 };
    let newMarket = 0;
    let points = 0;

    for (const raw of products) {
      this.stats.received += 1;
      const existingMarket = this.catalog.productsMarket.find(
        (m) => m.supermarketId === supermarketId && m.marketSku === raw.marketSku,
      );
      const occupied = new Set(
        this.catalog.productsMarket
          .filter((m) => m.supermarketId === supermarketId && m.productGlobalId != null)
          .map((m) => m.productGlobalId as number),
      );
      if (existingMarket?.productGlobalId != null) occupied.delete(existingMarket.productGlobalId);

      const outcome = matchProduct(
        { name: raw.name, ean: raw.ean, brand: raw.brand, productUrl: raw.productUrl },
        this.candidates.filter((c) => !occupied.has(c.id)),
        (ean) => {
          const hit = this.candidatesByEan.get(ean);
          return hit && !occupied.has(hit.id) ? hit : undefined;
        },
        DEFAULT_THRESHOLDS,
      );
      byStatus[outcome.status] += 1;

      const globalId = outcome.globalId ?? this.createGlobal(raw);
      if (outcome.globalId != null && raw.imageUrl) {
        const existing = this.catalog.productsGlobal.find((g) => g.id === globalId);
        if (existing && !existing.imageUrl) existing.imageUrl = raw.imageUrl;
      }

      let market = existingMarket;
      if (!market) {
        market = {
          id: this.nextMarketId++,
          productGlobalId: globalId,
          supermarketId,
          marketSku: raw.marketSku,
          nameMarket: raw.name,
          productUrl: raw.productUrl,
          imageUrl: raw.imageUrl,
          rawEan: raw.ean,
          brandMarket: raw.brand,
          matchStatus: outcome.status,
          matchConfidence: outcome.confidence,
          lastSeenAt: new Date().toISOString(),
        };
        this.catalog.productsMarket.push(market);
        newMarket += 1;
      } else {
        market.productGlobalId = globalId;
        market.nameMarket = raw.name;
        market.productUrl = raw.productUrl;
        market.imageUrl = raw.imageUrl;
        market.rawEan = raw.ean;
        market.brandMarket = raw.brand;
        market.matchStatus = outcome.status;
        market.matchConfidence = outcome.confidence;
        market.lastSeenAt = new Date().toISOString();
      }

      const existingPoint = this.catalog.priceHistory.find(
        (p) => p.productMarketId === market.id && p.capturedAt === this.today,
      );
      const point = {
        productMarketId: market.id,
        priceRegular: raw.priceRegular,
        pricePromo: raw.pricePromo,
        hasPromo: raw.hasPromo,
        pricePerUnit: raw.pricePerUnit,
        pricePerUnitUom: raw.pricePerUnitUom,
        capturedAt: this.today,
      };
      if (existingPoint) Object.assign(existingPoint, point);
      else this.catalog.priceHistory.push(point);
      points += 1;
    }

    this.stats.newMarketProducts += newMarket;
    this.stats.pricePoints += points;
    this.stats.matched += byStatus.matched;
    this.stats.review += byStatus.review;
    this.stats.orphan += byStatus.orphan;
    return { received: products.length, newMarketProducts: newMarket, pricePoints: points, ...byStatus };
  }

  async recordRun(run: ScrapeRunInput): Promise<void> {
    const saved: ScrapeRun = { id: this.nextRunId++, ...run };
    this.catalog.scrapeRuns.unshift(saved);
    this.catalog.scrapeRuns = this.catalog.scrapeRuns.slice(0, 200);
  }

  async finalize(): Promise<void> {
    const { relinkCatalog } = await import("@/lib/relink-catalog");
    this.catalog = relinkCatalog(this.catalog);
    this.catalog.scrapedAt = new Date().toISOString();
    saveLiveCatalog(this.catalog);
    console.log(
      `\n[ficheiro] ${this.catalog.productsGlobal.length} produtos, ${this.catalog.productsMarket.length} ofertas, ` +
        `${this.catalog.priceHistory.length} pontos de preco -> ${process.env.LIVE_CATALOG_PATH ?? "data/snapshots/live-catalog.json"}`,
    );
  }

  private createGlobal(raw: RawProduct): number {
    const q = parseQuantity(raw.name);
    const global: ProductGlobal = {
      id: this.nextGlobalId++,
      nameGlobal: raw.name,
      brand: raw.brand,
      eanCode: raw.ean,
      categoryId: guessCategoryId(raw.categoryPath, raw.name),
      imageUrl: raw.imageUrl,
      quantityValue: q?.value ?? null,
      quantityUnit: q?.unit ?? null,
      baseUnit: q?.baseUnit ?? null,
      baseQuantity: q?.baseQuantity ?? null,
    };
    this.catalog.productsGlobal.push(global);
    this.candidates.push(global);
    if (global.eanCode) this.candidatesByEan.set(global.eanCode, global);
    return global.id;
  }
}

function maxId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0);
}
