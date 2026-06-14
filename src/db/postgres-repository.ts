import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type {
  BasketComparison,
  BasketLine,
  Category,
  HistoryPoint,
  PriceDrop,
  PricePoint,
  ProductGlobal,
  ProductMarket,
  Supermarket,
  ProductWithOffers,
} from "@/lib/types";
import { getDb } from "@/db/client";
import {
  categories as categoriesTable,
  priceHistory,
  productsGlobal,
  productsMarket,
  supermarkets as supermarketsTable,
} from "@/db/schema";
import { normalizeText } from "@/lib/parsing";
import { downsample, type HistoryResult, type Repository } from "@/db/repository-types";
import {
  buildDrop,
  buildOffers,
  computeBasket,
  effectivePrice,
  toProductWithOffers,
} from "@/db/query-logic";

type Db = ReturnType<typeof getDb>;

/**
 * Implementacao PostgreSQL do repositorio, via Drizzle.
 *
 * Le precos atuais da materialized view `latest_prices` (mantida pelo pipeline
 * de scraping) e o historico diretamente de `price_history`. A logica de
 * dominio (ofertas, carrinho, drops) e partilhada com a versao em memoria
 * atraves de query-logic.ts.
 */
export class PostgresRepository implements Repository {
  private db: Db;

  constructor(db: Db = getDb()) {
    this.db = db;
  }

  async getSupermarkets(): Promise<Supermarket[]> {
    const rows = await this.db.select().from(supermarketsTable);
    return rows.map(mapSupermarket);
  }

  async getCategories(): Promise<Category[]> {
    const rows = await this.db.select().from(categoriesTable);
    return rows.map((c) => ({
      id: c.id,
      parentId: c.parentId ?? null,
      name: c.name,
      slug: c.slug,
    }));
  }

  /** Carrega supermercados como mapa (cache curto por chamada). */
  private async supermarketMap(): Promise<Map<number, Supermarket>> {
    const list = await this.getSupermarkets();
    return new Map(list.map((s) => [s.id, s]));
  }

  async getProduct(globalId: number): Promise<ProductWithOffers | null> {
    const [global] = await this.db
      .select()
      .from(productsGlobal)
      .where(eq(productsGlobal.id, globalId))
      .limit(1);
    if (!global) return null;

    const [smap, offersByGlobal, category] = await Promise.all([
      this.supermarketMap(),
      this.offersForGlobals([globalId]),
      this.categoryFor(global.categoryId),
    ]);

    const offers = buildOffers(
      offersByGlobal.markets.get(globalId) ?? [],
      offersByGlobal.latestByMarket,
      smap,
    );
    return toProductWithOffers(mapGlobal(global), offers, category);
  }

  async search(query: string, limit = 30): Promise<ProductWithOffers[]> {
    const q = normalizeText(query);
    // Usa o indice trigram via similaridade/ILIKE; sem query devolve um lote inicial.
    const rows = q
      ? await this.db
          .select()
          .from(productsGlobal)
          .where(
            sql`lower(unaccent(coalesce(${productsGlobal.brand}, '') || ' ' || ${productsGlobal.nameGlobal})) ILIKE ${"%" + q + "%"}
                OR similarity(lower(unaccent(coalesce(${productsGlobal.brand}, '') || ' ' || ${productsGlobal.nameGlobal})), ${q}) > 0.2`,
          )
          .orderBy(
            sql`similarity(lower(unaccent(coalesce(${productsGlobal.brand}, '') || ' ' || ${productsGlobal.nameGlobal})), ${q}) DESC`,
          )
          .limit(limit)
      : await this.db.select().from(productsGlobal).orderBy(productsGlobal.nameGlobal).limit(limit);

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const [smap, offersByGlobal, categoriesById] = await Promise.all([
      this.supermarketMap(),
      this.offersForGlobals(ids),
      this.categoryMap(),
    ]);

    return rows.map((global) => {
      const offers = buildOffers(
        offersByGlobal.markets.get(global.id) ?? [],
        offersByGlobal.latestByMarket,
        smap,
      );
      const category = global.categoryId ? categoriesById.get(global.categoryId) ?? null : null;
      return toProductWithOffers(mapGlobal(global), offers, category);
    });
  }

  async getHistory(globalId: number, days = 30): Promise<HistoryResult> {
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        supermarketId: productsMarket.supermarketId,
        capturedAt: priceHistory.capturedAt,
        priceRegular: priceHistory.priceRegular,
        pricePromo: priceHistory.pricePromo,
      })
      .from(priceHistory)
      .innerJoin(productsMarket, eq(priceHistory.productMarketId, productsMarket.id))
      .where(
        and(eq(productsMarket.productGlobalId, globalId), gte(priceHistory.capturedAt, cutoffIso)),
      )
      .orderBy(priceHistory.capturedAt);

    const smap = await this.supermarketMap();
    const involved = new Map<number, Supermarket>();
    const byDate = new Map<string, Record<string, number | null>>();

    for (const r of rows) {
      const supermarket = smap.get(r.supermarketId);
      if (!supermarket) continue;
      involved.set(supermarket.id, supermarket);
      const price = num(r.pricePromo) ?? num(r.priceRegular)!;
      const dateKey = String(r.capturedAt);
      const row = byDate.get(dateKey) ?? {};
      row[supermarket.slug] = price;
      byDate.set(dateKey, row);
    }

    const points: HistoryPoint[] = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, prices]) => ({ date, prices }));

    return { supermarkets: [...involved.values()], points: downsample(points, 90) };
  }

  async biggestDrops(limit = 8): Promise<PriceDrop[]> {
    // Compara o ultimo preco (latest_prices) com o penultimo registo por oferta.
    const rows = await this.db.execute<{
      product_global_id: number;
      supermarket_id: number;
      current_price: string;
      previous_price: string;
    }>(sql`
      WITH ranked AS (
        SELECT ph.product_market_id,
               pm.product_global_id,
               pm.supermarket_id,
               COALESCE(ph.price_promo, ph.price_regular) AS price,
               ROW_NUMBER() OVER (PARTITION BY ph.product_market_id ORDER BY ph.captured_at DESC) AS rn
        FROM price_history ph
        JOIN products_market pm ON pm.id = ph.product_market_id
      )
      SELECT cur.product_global_id,
             cur.supermarket_id,
             cur.price AS current_price,
             prev.price AS previous_price
      FROM ranked cur
      JOIN ranked prev
        ON prev.product_market_id = cur.product_market_id AND prev.rn = 2
      WHERE cur.rn = 1
        AND prev.price > cur.price
        AND cur.product_global_id IS NOT NULL
      ORDER BY (prev.price - cur.price) / prev.price DESC
      LIMIT ${limit}
    `);

    const records = extractRows(rows);
    if (records.length === 0) return [];

    const [smap, globalsById] = await Promise.all([
      this.supermarketMap(),
      this.globalMap(records.map((r) => r.product_global_id)),
    ]);

    const drops: PriceDrop[] = [];
    for (const r of records) {
      const global = globalsById.get(r.product_global_id);
      const supermarket = smap.get(r.supermarket_id);
      if (!global || !supermarket) continue;
      const drop = buildDrop(global, supermarket, Number(r.previous_price), Number(r.current_price));
      if (drop) drops.push(drop);
    }
    return drops;
  }

  async compareBasket(lines: BasketLine[]): Promise<BasketComparison> {
    const ids = [...new Set(lines.map((l) => l.productGlobalId))];
    const [smap, offersByGlobal, globalsById] = await Promise.all([
      this.supermarketMap(),
      this.offersForGlobals(ids),
      this.globalMap(ids),
    ]);

    const productNameById = new Map<number, string>();
    for (const [id, g] of globalsById) productNameById.set(id, g.nameGlobal);

    // Index preco efetivo por (globalId, supermarketId).
    const priceByKey = new Map<string, number>();
    for (const id of ids) {
      for (const m of offersByGlobal.markets.get(id) ?? []) {
        const latest = offersByGlobal.latestByMarket.get(m.id);
        if (!latest) continue;
        priceByKey.set(`${id}:${m.supermarketId}`, effectivePrice(latest));
      }
    }

    return computeBasket(
      lines,
      [...smap.values()],
      productNameById,
      (productGlobalId, supermarketId) =>
        priceByKey.get(`${productGlobalId}:${supermarketId}`) ?? null,
    );
  }

  // ── Helpers de carregamento ────────────────────────────────────────────────

  /**
   * Para um conjunto de produtos globais, carrega as ofertas de mercado e o
   * preco mais recente de cada (a partir da materialized view latest_prices).
   */
  private async offersForGlobals(globalIds: number[]): Promise<{
    markets: Map<number, ProductMarket[]>;
    latestByMarket: Map<number, PricePoint>;
  }> {
    const markets = new Map<number, ProductMarket[]>();
    const latestByMarket = new Map<number, PricePoint>();
    if (globalIds.length === 0) return { markets, latestByMarket };

    const marketRows = await this.db
      .select()
      .from(productsMarket)
      .where(inArray(productsMarket.productGlobalId, globalIds));

    const marketIds: number[] = [];
    for (const m of marketRows) {
      marketIds.push(m.id);
      const gId = m.productGlobalId!;
      const list = markets.get(gId) ?? [];
      list.push(mapMarket(m));
      markets.set(gId, list);
    }
    if (marketIds.length === 0) return { markets, latestByMarket };

    const latestRows = await this.db.execute<{
      product_market_id: number;
      effective_price: string;
      price_regular: string;
      price_promo: string | null;
      has_promo: boolean;
      price_per_unit: string | null;
      price_per_unit_uom: string | null;
      captured_at: string;
    }>(sql`
      SELECT product_market_id, effective_price, price_regular, price_promo,
             has_promo, price_per_unit, price_per_unit_uom, captured_at
      FROM latest_prices
      WHERE product_market_id IN ${sql`(${sql.join(
        marketIds.map((id) => sql`${id}`),
        sql`, `,
      )})`}
    `);

    for (const r of extractRows(latestRows)) {
      latestByMarket.set(r.product_market_id, {
        productMarketId: r.product_market_id,
        priceRegular: Number(r.price_regular),
        pricePromo: r.price_promo != null ? Number(r.price_promo) : null,
        hasPromo: r.has_promo,
        pricePerUnit: r.price_per_unit != null ? Number(r.price_per_unit) : null,
        pricePerUnitUom: (r.price_per_unit_uom as PricePoint["pricePerUnitUom"]) ?? null,
        capturedAt: String(r.captured_at).slice(0, 10),
      });
    }

    return { markets, latestByMarket };
  }

  private async categoryFor(categoryId: number | null): Promise<Category | null> {
    if (categoryId == null) return null;
    const [c] = await this.db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);
    return c ? { id: c.id, parentId: c.parentId ?? null, name: c.name, slug: c.slug } : null;
  }

  private async categoryMap(): Promise<Map<number, Category>> {
    const list = await this.getCategories();
    return new Map(list.map((c) => [c.id, c]));
  }

  private async globalMap(ids: number[]): Promise<Map<number, ProductGlobal>> {
    const map = new Map<number, ProductGlobal>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .select()
      .from(productsGlobal)
      .where(inArray(productsGlobal.id, [...new Set(ids)]));
    for (const r of rows) map.set(r.id, mapGlobal(r));
    return map;
  }
}

// ── Mapeadores (linha DB -> tipo de dominio) ─────────────────────────────────

function mapSupermarket(s: typeof supermarketsTable.$inferSelect): Supermarket {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl ?? null,
    baseUrl: s.baseUrl,
    colorHex: s.colorHex ?? null,
    isActive: s.isActive,
  };
}

function mapGlobal(g: typeof productsGlobal.$inferSelect): ProductGlobal {
  return {
    id: g.id,
    nameGlobal: g.nameGlobal,
    brand: g.brand ?? null,
    eanCode: g.eanCode ?? null,
    categoryId: g.categoryId ?? null,
    imageUrl: g.imageUrl ?? null,
    quantityValue: num(g.quantityValue),
    quantityUnit: (g.quantityUnit as ProductGlobal["quantityUnit"]) ?? null,
    baseUnit: (g.baseUnit as ProductGlobal["baseUnit"]) ?? null,
    baseQuantity: num(g.baseQuantity),
  };
}

function mapMarket(m: typeof productsMarket.$inferSelect): ProductMarket {
  return {
    id: m.id,
    productGlobalId: m.productGlobalId ?? null,
    supermarketId: m.supermarketId,
    marketSku: m.marketSku,
    nameMarket: m.nameMarket,
    productUrl: m.productUrl ?? null,
    imageUrl: m.imageUrl ?? null,
    rawEan: m.rawEan ?? null,
    matchStatus: m.matchStatus as ProductMarket["matchStatus"],
    matchConfidence: m.matchConfidence ?? null,
    lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
  };
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** drizzle execute devolve { rows } (node-postgres) ou array — normaliza. */
function extractRows<T>(result: T[] | { rows: T[] }): T[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result) {
    return result.rows;
  }
  return [];
}
