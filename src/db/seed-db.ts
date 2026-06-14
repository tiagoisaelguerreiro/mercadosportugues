/**
 * Popula a base de dados PostgreSQL com os dados seed (supermercados,
 * categorias, produtos globais, ofertas de mercado e 365 dias de historico).
 *
 * Uso:
 *   USE_DB=true DATABASE_URL=... tsx src/db/seed-db.ts
 *
 * Pre-requisito: o esquema (db/schema.sql) tem de estar aplicado. Com o
 * docker-compose incluido, o schema e aplicado automaticamente ao criar a DB.
 *
 * Idempotente: usa ON CONFLICT por chaves naturais, por isso pode correr varias
 * vezes sem duplicar.
 */
import { sql } from "drizzle-orm";
import { getDb, getPool } from "./client";
import {
  categories,
  priceHistory,
  productsGlobal,
  productsMarket,
  supermarkets,
} from "./schema";
import {
  categories as seedCategories,
  priceHistory as seedHistory,
  productsGlobal as seedGlobal,
  productsMarket as seedMarket,
  supermarkets as seedSupermarkets,
} from "./seed-data";

async function main() {
  if (process.env.USE_DB !== "true") {
    console.error("Define USE_DB=true e DATABASE_URL para semear a base de dados.");
    process.exit(1);
  }

  const db = getDb();
  console.log("A semear PostgreSQL…");

  // Garante particoes para todos os meses presentes no historico.
  const months = new Set(seedHistory.map((p) => p.capturedAt.slice(0, 7)));
  for (const m of months) {
    await db.execute(sql`SELECT ensure_price_partition(${`${m}-01`}::date)`);
  }

  await db
    .insert(supermarkets)
    .values(
      seedSupermarkets.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        logoUrl: s.logoUrl,
        baseUrl: s.baseUrl,
        colorHex: s.colorHex,
        isActive: s.isActive,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(categories)
    .values(
      seedCategories.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        slug: c.slug,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(productsGlobal)
    .values(
      seedGlobal.map((g) => ({
        id: g.id,
        nameGlobal: g.nameGlobal,
        brand: g.brand,
        eanCode: g.eanCode,
        categoryId: g.categoryId,
        imageUrl: g.imageUrl,
        quantityValue: g.quantityValue != null ? String(g.quantityValue) : null,
        quantityUnit: g.quantityUnit,
        baseUnit: g.baseUnit,
        baseQuantity: g.baseQuantity != null ? String(g.baseQuantity) : null,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(productsMarket)
    .values(
      seedMarket.map((m) => ({
        id: m.id,
        productGlobalId: m.productGlobalId,
        supermarketId: m.supermarketId,
        marketSku: m.marketSku,
        nameMarket: m.nameMarket,
        productUrl: m.productUrl,
        imageUrl: m.imageUrl,
        rawEan: m.rawEan,
        matchStatus: m.matchStatus,
        matchConfidence: m.matchConfidence,
        lastSeenAt: m.lastSeenAt ? new Date(m.lastSeenAt) : null,
      })),
    )
    .onConflictDoNothing();

  // Historico em lotes para nao exceder limites de parametros.
  const batchSize = 500;
  for (let i = 0; i < seedHistory.length; i += batchSize) {
    const batch = seedHistory.slice(i, i + batchSize);
    await db
      .insert(priceHistory)
      .values(
        batch.map((p) => ({
          productMarketId: p.productMarketId,
          priceRegular: String(p.priceRegular),
          pricePromo: p.pricePromo != null ? String(p.pricePromo) : null,
          hasPromo: p.hasPromo,
          pricePerUnit: p.pricePerUnit != null ? String(p.pricePerUnit) : null,
          pricePerUnitUom: p.pricePerUnitUom,
          capturedAt: p.capturedAt,
        })),
      )
      .onConflictDoNothing();
  }

  // Sincroniza as sequencias depois de inserir IDs explicitos.
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('products_global', 'id'), (SELECT MAX(id) FROM products_global))`,
  );
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('products_market', 'id'), (SELECT MAX(id) FROM products_market))`,
  );

  await db.execute(sql`REFRESH MATERIALIZED VIEW latest_prices`);

  console.log(
    `Concluido: ${seedSupermarkets.length} supermercados, ${seedGlobal.length} produtos, ` +
      `${seedMarket.length} ofertas, ${seedHistory.length} pontos de preco.`,
  );
  await getPool().end();
}

main().catch((err) => {
  console.error("Falha ao semear:", err);
  process.exit(1);
});
