import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { PricePoint, ProductGlobal, ProductMarket, ScrapeRun } from "@/lib/types";

export interface LiveCatalog {
  version: 1;
  scrapedAt: string;
  productsGlobal: ProductGlobal[];
  productsMarket: ProductMarket[];
  priceHistory: PricePoint[];
  scrapeRuns: ScrapeRun[];
}

export function liveCatalogPath(): string {
  return resolve(process.env.LIVE_CATALOG_PATH ?? "data/snapshots/live-catalog.json");
}

export function loadLiveCatalog(): LiveCatalog | null {
  if (process.env.VITEST === "true") return null;
  const path = liveCatalogPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as LiveCatalog;
    if (parsed?.version !== 1 || !parsed.productsGlobal?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLiveCatalog(catalog: LiveCatalog): void {
  const path = liveCatalogPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(catalog, null, 2), "utf8");
}

export function guessCategoryId(categoryPath: string | null | undefined, name: string): number | null {
  const text = `${categoryPath ?? ""} ${name}`.toLowerCase();
  if (/limpez|deterg|skip|higiene|casa e/.test(text)) return 4;
  if (/latic|lacteo|leite|iogurte|ovo|manteiga|queijo|natas/.test(text)) return 2;
  if (/bebida|agua|sumo|cola|cerveja|vinho|refriger|garrafeira/.test(text)) return 3;
  if (/mercear|arroz|massa|azeite|cafe|conserv/.test(text)) return 1;
  return 1;
}
