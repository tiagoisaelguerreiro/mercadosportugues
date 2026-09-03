import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileCatalogSink } from "@/scrapers/core/file-sink";
import { liveCatalogPath } from "@/db/live-catalog";

describe("FileCatalogSink", () => {
  const previous = process.env.LIVE_CATALOG_PATH;
  afterEach(() => {
    if (previous == null) delete process.env.LIVE_CATALOG_PATH;
    else process.env.LIVE_CATALOG_PATH = previous;
  });

  it("grava produtos e precos do dia num JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mp-catalog-"));
    process.env.LIVE_CATALOG_PATH = join(dir, "live.json");
    const sink = new FileCatalogSink();
    await sink.persistBatch(1, [
      {
        marketSku: "sku-1",
        name: "Leite Mimosa 1L",
        brand: "Mimosa",
        ean: "5601010000017",
        priceRegular: 0.95,
        pricePromo: 0.89,
        hasPromo: true,
        pricePerUnit: 0.89,
        pricePerUnitUom: "L",
        imageUrl: "https://example.test/leite.jpg",
        productUrl: "https://example.test/leite",
        categoryPath: "Laticínios",
      },
    ]);
    await sink.finalize();
    const saved = JSON.parse(readFileSync(liveCatalogPath(), "utf8"));
    expect(saved.productsGlobal).toHaveLength(1);
    expect(saved.productsMarket).toHaveLength(1);
    expect(saved.priceHistory).toHaveLength(1);
    expect(saved.productsGlobal[0].imageUrl).toContain("leite.jpg");
  });

  it("nao junta dois SKUs do mesmo supermercado no mesmo produto global", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mp-catalog-"));
    process.env.LIVE_CATALOG_PATH = join(dir, "live.json");
    const sink = new FileCatalogSink();
    await sink.persistBatch(8, [
      {
        marketSku: "beer-can",
        name: "Cerveza Clásica Steinburg Lata",
        brand: "Steinburg",
        ean: null,
        priceRegular: 0.3,
        pricePromo: null,
        hasPromo: false,
        pricePerUnit: 0.3,
        pricePerUnitUom: "un",
        imageUrl: null,
        productUrl: null,
        categoryPath: "Bebidas",
      },
      {
        marketSku: "beer-pack",
        name: "Cerveza Clásica Steinburg Pack-12",
        brand: "Steinburg",
        ean: null,
        priceRegular: 3.6,
        pricePromo: null,
        hasPromo: false,
        pricePerUnit: 0.3,
        pricePerUnitUom: "un",
        imageUrl: null,
        productUrl: null,
        categoryPath: "Bebidas",
      },
    ]);
    await sink.finalize();
    const saved = JSON.parse(readFileSync(liveCatalogPath(), "utf8"));
    expect(saved.productsGlobal).toHaveLength(2);
    expect(saved.productsMarket).toHaveLength(2);
    expect(new Set(saved.productsMarket.map((m: { productGlobalId: number }) => m.productGlobalId)).size).toBe(2);
  });
});
