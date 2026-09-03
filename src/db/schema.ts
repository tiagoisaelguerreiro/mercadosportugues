import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  real,
  serial,
  smallint,
  smallserial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const supermarkets = pgTable("supermarkets", {
  id: smallserial("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  logoUrl: text("logo_url"),
  baseUrl: text("base_url").notNull(),
  colorHex: varchar("color_hex", { length: 7 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
});

export const productsGlobal = pgTable(
  "products_global",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    nameGlobal: varchar("name_global", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    eanCode: varchar("ean_code", { length: 14 }).unique(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    imageUrl: text("image_url"),
    quantityValue: numeric("quantity_value", { precision: 10, scale: 3 }),
    quantityUnit: varchar("quantity_unit", { length: 8 }),
    baseUnit: varchar("base_unit", { length: 4 }),
    baseQuantity: numeric("base_quantity", { precision: 12, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_products_global_ean").on(t.eanCode),
    index("idx_products_global_category").on(t.categoryId),
  ],
);

export const productsMarket = pgTable(
  "products_market",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productGlobalId: bigint("product_global_id", { mode: "number" }).references(
      () => productsGlobal.id,
      { onDelete: "set null" },
    ),
    supermarketId: smallint("supermarket_id")
      .notNull()
      .references(() => supermarkets.id),
    marketSku: varchar("market_sku", { length: 64 }).notNull(),
    nameMarket: varchar("name_market", { length: 255 }).notNull(),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    rawEan: varchar("raw_ean", { length: 14 }),
    matchStatus: varchar("match_status", { length: 16 }).notNull().default("pending"),
    matchConfidence: real("match_confidence"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_pm_sku").on(t.supermarketId, t.marketSku),
    index("idx_pm_global").on(t.productGlobalId),
    index("idx_pm_status").on(t.matchStatus),
    index("idx_pm_market").on(t.supermarketId),
  ],
);

export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    supermarketId: smallint("supermarket_id")
      .notNull()
      .references(() => supermarkets.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("running"),
    productsReceived: integer("products_received").notNull().default(0),
    newMarketProducts: integer("new_market_products").notNull().default(0),
    pricePoints: integer("price_points").notNull().default(0),
    matchedCount: integer("matched_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    orphanCount: integer("orphan_count").notNull().default(0),
    dryRun: boolean("dry_run").notNull().default(false),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("idx_scrape_runs_started").on(t.startedAt),
    index("idx_scrape_runs_market").on(t.supermarketId, t.startedAt),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: bigserial("id", { mode: "number" }),
    productMarketId: bigint("product_market_id", { mode: "number" })
      .notNull()
      .references(() => productsMarket.id, { onDelete: "cascade" }),
    priceRegular: numeric("price_regular", { precision: 10, scale: 2 }).notNull(),
    pricePromo: numeric("price_promo", { precision: 10, scale: 2 }),
    hasPromo: boolean("has_promo").notNull().default(false),
    pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 4 }),
    pricePerUnitUom: varchar("price_per_unit_uom", { length: 8 }),
    capturedAt: date("captured_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_price_per_day").on(t.productMarketId, t.capturedAt),
    index("idx_price_history_pm").on(t.productMarketId, t.capturedAt),
  ],
);
