/**
 * Enriquecimento de EANs para ofertas que nao os trazem da grelha/API.
 *
 * Uso:
 *   npm run enrich:eans                              # 200 ofertas, todas as fontes
 *   npm run enrich:eans -- --only=auchan --limit=500
 *   npm run enrich:eans -- --source=off --limit=100  # so OpenFoodFacts
 *   npm run enrich:eans -- --dry-run                 # pre-visualiza sem gravar
 *
 * Fontes por supermercado (confirmadas):
 *   - auchan     -> JSON-LD `gtin` da pagina de produto
 *   - continente -> parametro `ean=` do data-url nutricional da pagina
 *   - pingo-doce, mercadona, outros -> OpenFoodFacts (criterio estrito)
 *
 * Prioriza ofertas de produtos presentes em 2+ supermercados (onde o EAN
 * destrava matches entre lojas), depois a fila de revisao, depois o resto.
 * Idempotente: salta ofertas que ja tem rawEan (retomar e seguro).
 * No fim, corre `npm run rematch` para ligar os EANs novos entre lojas.
 */
import { getDb } from "@/db/client";
import { liveCatalogPath, loadLiveCatalog, saveLiveCatalog, type LiveCatalog } from "@/db/live-catalog";
import { loadDotEnv } from "@/lib/load-dotenv";
import { isValidEan } from "@/lib/parsing";
import type { ProductMarket } from "@/lib/types";
import { HttpClient } from "../core/http-client";
import { extractContinenteEans, extractJsonLdProducts } from "../core/html";
import { findEanViaOff } from "../core/openfoodfacts";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { productsMarket, supermarkets } from "@/db/schema";

interface Args {
  only?: string[];
  limit: number;
  source: "pdp" | "off" | "all";
  dryRun: boolean;
}

interface Candidate {
  marketId: number;
  supermarketId: number;
  supermarketSlug: string;
  name: string;
  brand: string | null;
  url: string | null;
  priority: number;
}

const PDP_SLUGS = new Set(["auchan", "continente"]);

function parseArgs(argv: string[]): Args {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const only = get("only")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.max(1, Number(get("limit") ?? 200) || 200);
  const source = get("source") === "pdp" || get("source") === "off" ? get("source")! : "all";
  return { only, limit, source: source as Args["source"], dryRun: argv.includes("--dry-run") };
}

async function pdpEan(http: HttpClient, slug: string, url: string): Promise<string | null> {
  let html: string;
  try {
    html = await http.getText(url);
  } catch {
    return null;
  }
  if (slug === "auchan") {
    for (const p of extractJsonLdProducts(html)) {
      if (p.gtin && isValidEan(p.gtin)) return p.gtin.replace(/\D/g, "");
    }
    return null;
  }
  if (slug === "continente") {
    for (const ean of extractContinenteEans(html)) {
      if (isValidEan(ean)) return ean;
    }
    return null;
  }
  return null;
}

function prioritize(
  offers: Array<{
    market: ProductMarket;
    slug: string;
    multiStore: boolean;
  }>,
): Candidate[] {
  return offers
    .map(({ market, slug, multiStore }) => ({
      marketId: market.id,
      supermarketId: market.supermarketId,
      supermarketSlug: slug,
      name: market.nameMarket,
      brand: market.brandMarket ?? null,
      url: market.productUrl,
      priority:
        (multiStore ? 0 : 2) + (market.matchStatus === "review" ? -1 : 0),
    }))
    .sort((a, b) => a.priority - b.priority || a.marketId - b.marketId);
}

async function enrichCandidate(
  http: HttpClient,
  offHttp: HttpClient,
  candidate: Candidate,
  source: Args["source"],
): Promise<{ ean: string | null; via: string }> {
  const usePdp = source !== "off" && PDP_SLUGS.has(candidate.supermarketSlug) && candidate.url;
  if (usePdp) {
    const ean = await pdpEan(http, candidate.supermarketSlug, candidate.url!);
    if (ean) return { ean, via: "pdp" };
    if (source === "pdp") return { ean: null, via: "pdp" };
  }
  if (source === "pdp") return { ean: null, via: "pdp" };
  const ean = await findEanViaOff(offHttp, candidate.name, candidate.brand);
  return { ean, via: "off" };
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const useDb = process.env.USE_DB === "true";

  const http = new HttpClient();
  const offHttp = new HttpClient({
    minDelayMs: 1200,
    maxDelayMs: 2500,
    defaultHeaders: {
      "User-Agent": "MercadosPortugues/0.1 (comparador de precos PT; contacto via site)",
      Accept: "application/json",
    },
  });

  // 1) Carrega ofertas sem EAN.
  let catalog: LiveCatalog | null = null;
  // Slugs conhecidos (para --only e encaminhamento pdp/off).
  const slugById = new Map<number, string>([
    [1, "continente"],
    [2, "pingo-doce"],
    [3, "aldi"],
    [4, "intermarche"],
    [5, "lidl"],
    [6, "auchan"],
    [7, "minipreco"],
    [8, "mercadona"],
  ]);
  type Row = {
    id: number;
    supermarketId: number;
    nameMarket: string;
    brandMarket: string | null;
    productUrl: string | null;
    matchStatus: string;
    productGlobalId: number | null;
  };
  let rows: Row[];

  if (useDb) {
    if (!process.env.DATABASE_URL) {
      console.error("✖ USE_DB=true exige DATABASE_URL.");
      process.exit(1);
    }
    const db = getDb();
    const sups = await db.select().from(supermarkets);
    for (const s of sups) slugById.set(s.id, s.slug);
    const dbRows = await db
      .select({
        id: productsMarket.id,
        supermarketId: productsMarket.supermarketId,
        nameMarket: productsMarket.nameMarket,
        brandMarket: productsMarket.brandMarket,
        productUrl: productsMarket.productUrl,
        matchStatus: productsMarket.matchStatus,
        productGlobalId: productsMarket.productGlobalId,
      })
      .from(productsMarket)
      .where(and(isNull(productsMarket.rawEan), isNotNull(productsMarket.productUrl)));
    rows = dbRows.map((r) => ({
      ...r,
      brandMarket: r.brandMarket ?? null,
      productUrl: r.productUrl ?? null,
      productGlobalId: r.productGlobalId ?? null,
    }));
  } else {
    catalog = loadLiveCatalog();
    if (!catalog) {
      console.error("✖ Sem catalogo local. Corre primeiro `npm run scrape`.");
      process.exit(1);
    }
    // slugById ja traz os slugs conhecidos (ver inicializacao acima).
    rows = catalog.productsMarket
      .filter((m) => !m.rawEan && m.productUrl)
      .map((m) => ({
        id: m.id,
        supermarketId: m.supermarketId,
        nameMarket: m.nameMarket,
        brandMarket: m.brandMarket ?? null,
        productUrl: m.productUrl,
        matchStatus: m.matchStatus,
        productGlobalId: m.productGlobalId,
      }));
  }

  // Contagem de lojas por produto global (para priorizar multi-loja).
  const storeCountByGlobal = new Map<number, number>();
  const allOffers: Array<{ market: ProductMarket; slug: string; multiStore: boolean }> = [];

  if (!useDb && catalog) {
    const stores = new Map<number, Set<number>>();
    for (const m of catalog.productsMarket) {
      if (m.productGlobalId == null) continue;
      const set = stores.get(m.productGlobalId) ?? new Set<number>();
      set.add(m.supermarketId);
      stores.set(m.productGlobalId, set);
    }
    for (const [globalId, set] of stores) storeCountByGlobal.set(globalId, set.size);
  } else if (useDb) {
    const db = getDb();
    const counts = await db.execute(sql`
      SELECT product_global_id AS "globalId", COUNT(DISTINCT supermarket_id)::int AS "stores"
      FROM products_market WHERE product_global_id IS NOT NULL GROUP BY product_global_id
    `);
    const list = (
      Array.isArray(counts) ? counts : (counts as { rows: unknown[] }).rows ?? []
    ) as Array<{ globalId: number; stores: number }>;
    for (const row of list) storeCountByGlobal.set(row.globalId, row.stores);
  }

  for (const r of rows) {
    const slug = slugById.get(r.supermarketId) ?? `#${r.supermarketId}`;
    if (args.only && !args.only.includes(slug)) continue;
    const multiStore =
      r.productGlobalId != null && (storeCountByGlobal.get(r.productGlobalId) ?? 0) >= 2;
    allOffers.push({
      market: {
        id: r.id,
        productGlobalId: r.productGlobalId,
        supermarketId: r.supermarketId,
        marketSku: "",
        nameMarket: r.nameMarket,
        productUrl: r.productUrl,
        imageUrl: null,
        rawEan: null,
        brandMarket: r.brandMarket,
        matchStatus: r.matchStatus as ProductMarket["matchStatus"],
        matchConfidence: null,
        lastSeenAt: null,
      },
      slug,
      multiStore,
    });
  }

  const candidates = prioritize(allOffers).slice(0, args.limit);
  console.log(
    `EAN enrichment: ${candidates.length} ofertas (fonte=${args.source}${args.dryRun ? ", DRY-RUN" : ""}${args.only ? `, lojas=${args.only.join(",")}` : ""})`,
  );

  let found = 0;
  let pdpHits = 0;
  let offHits = 0;
  const updates = new Map<number, string>();

  // Guarda progresso de forma incremental: abortar a meio nao perde o ja feito.
  const SAVE_EVERY = 25;
  let savedCount = 0;
  const flush = async (): Promise<void> => {
    if (args.dryRun || updates.size === 0) return;
    if (useDb) {
      const db = getDb();
      for (const [id, ean] of updates) {
        await db
          .update(productsMarket)
          .set({ rawEan: ean })
          .where(eq(productsMarket.id, id));
      }
      savedCount += updates.size;
      console.log(`  ... gravados ${savedCount} EANs em PostgreSQL`);
    } else if (catalog) {
      for (const m of catalog.productsMarket) {
        const ean = updates.get(m.id);
        if (ean) m.rawEan = ean;
      }
      saveLiveCatalog(catalog);
      savedCount += updates.size;
      console.log(`  ... gravados ${savedCount} EANs em ${liveCatalogPath()}`);
    }
    updates.clear();
  };

  for (const [i, candidate] of candidates.entries()) {
    const { ean, via } = await enrichCandidate(http, offHttp, candidate, args.source);
    if (ean) {
      found++;
      if (via === "pdp") pdpHits++;
      else offHits++;
      updates.set(candidate.marketId, ean);
      console.log(
        `  [${i + 1}/${candidates.length}] ✔ ${candidate.supermarketSlug} "${candidate.name.slice(0, 50)}" -> ${ean} (${via})`,
      );
      if (updates.size >= SAVE_EVERY) await flush();
    } else if ((i + 1) % 25 === 0) {
      console.log(`  [${i + 1}/${candidates.length}] ... ${found} EANs ate agora`);
    }
  }

  await flush();

  console.log(
    `\nResumo: ${found}/${candidates.length} com EAN (pdp=${pdpHits}, off=${offHits})${args.dryRun ? " — DRY-RUN, nada gravado" : `, ${savedCount} gravados`}.`,
  );
  if (found > 0 && !args.dryRun) {
    console.log("Proximo passo: `npm run rematch` para ligar os EANs novos entre lojas.");
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && /enrich-eans\.(ts|js|mjs)$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error("Falha no enriquecimento de EANs:", err);
    process.exit(1);
  });
}
