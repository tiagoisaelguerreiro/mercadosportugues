/**
 * Orquestrador do pipeline diario de scraping.
 *
 * Uso:
 *   tsx src/scrapers/pipeline/run-daily.ts                 # todos os adapters ativos
 *   tsx src/scrapers/pipeline/run-daily.ts --only=continente
 *   tsx src/scrapers/pipeline/run-daily.ts --only=continente,auchan
 *
 * Em producao, este script e disparado por um cron (ver
 * .github/workflows/daily-scrape.yml) todos os dias as 04:00.
 *
 * Cada adapter corre isolado: uma falha num supermercado nao impede os outros.
 * O resultado de cada adapter (contagens, matching, erro) e registado no sink
 * (`scrape_runs` em PostgreSQL) para alimentar o painel admin.
 */
import { BaseAdapter } from "../core/base-adapter";
import {
  addPersistResults,
  EMPTY_PERSIST_RESULT,
  type PersistResult,
  type PriceSink,
} from "../core/persistence";
import { ContinenteAdapter } from "../adapters/continente";
import { PingoDoceAdapter } from "../adapters/pingo-doce";
import { AuchanAdapter } from "../adapters/auchan";
import { MercadonaAdapter } from "../adapters/mercadona";
import type { RawProduct, ScrapeRunInput } from "@/lib/types";
import { loadDotEnv } from "@/lib/load-dotenv";

const BATCH_SIZE = 200;

export function buildAdapters(only?: string[]): BaseAdapter[] {
  const all: BaseAdapter[] = [
    new ContinenteAdapter(),
    new PingoDoceAdapter(),
    new AuchanAdapter(),
    new MercadonaAdapter(),
    // Sem catalogo online completo em Portugal (apenas folhetos):
    // Lidl, Aldi e Intermarche sao alimentados por importacao.
  ];
  return only?.length ? all.filter((a) => only.includes(a.slug)) : all;
}

export function parseArgs(argv: string[]): { only?: string[] } {
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  const list = onlyArg
    ?.split("=")[1]
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { only: list?.length ? list : undefined };
}

export interface AdapterRunSummary {
  slug: string;
  status: "success" | "failed";
  durationMs: number;
  result: PersistResult;
  error: string | null;
}

/** Corre um adapter ate ao fim, persistindo em lotes, e regista a execucao. */
export async function runAdapter(
  adapter: BaseAdapter,
  sink: PriceSink,
  dryRun: boolean,
): Promise<AdapterRunSummary> {
  const startedAt = new Date();
  console.log(`\n▶ A correr adapter: ${adapter.slug}`);
  const batch: RawProduct[] = [];
  let totals = EMPTY_PERSIST_RESULT;
  let error: string | null = null;

  try {
    for await (const product of adapter.fetchAll()) {
      batch.push(product);
      if (batch.length >= BATCH_SIZE) {
        totals = addPersistResults(totals, await sink.persistBatch(adapter.supermarketId, batch.splice(0)));
      }
    }
    if (batch.length) {
      totals = addPersistResults(totals, await sink.persistBatch(adapter.supermarketId, batch.splice(0)));
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`✖ Erro no adapter ${adapter.slug}:`, error);
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const status = error ? "failed" : "success";

  const run: ScrapeRunInput = {
    supermarketId: adapter.supermarketId,
    supermarketSlug: adapter.slug,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status,
    productsReceived: totals.received,
    newMarketProducts: totals.newMarketProducts,
    pricePoints: totals.pricePoints,
    matched: totals.matched,
    review: totals.review,
    orphan: totals.orphan,
    dryRun,
    errorMessage: error,
  };
  try {
    await sink.recordRun(run);
  } catch (err) {
    console.error(`⚠ Nao foi possivel registar a execucao de ${adapter.slug}:`, err);
  }

  if (!error) {
    console.log(
      `✔ ${adapter.slug}: ${totals.received} produtos em ${(durationMs / 1000).toFixed(1)}s ` +
        `(matched=${totals.matched} review=${totals.review} orphan=${totals.orphan})`,
    );
  }
  return { slug: adapter.slug, status, durationMs, result: totals, error };
}

function printSummary(summaries: AdapterRunSummary[]): void {
  console.log("\n┌ Resumo da execucao");
  for (const s of summaries) {
    const icon = s.status === "success" ? "✔" : "✖";
    const secs = (s.durationMs / 1000).toFixed(1);
    const detail =
      s.status === "success"
        ? `${s.result.received} produtos · ${s.result.pricePoints} precos · review=${s.result.review}`
        : `falhou: ${s.error}`;
    console.log(`│ ${icon} ${s.slug.padEnd(12)} ${secs.padStart(6)}s  ${detail}`);
  }
  console.log("└");
}

async function main(): Promise<void> {
  loadDotEnv();
  const { only } = parseArgs(process.argv.slice(2));
  const adapters = buildAdapters(only);
  if (adapters.length === 0) {
    console.error(`Nenhum adapter encontrado${only ? ` para "${only.join(",")}"` : ""}.`);
    process.exit(1);
  }

  const useDb = process.env.USE_DB === "true";
  const dryRun = process.env.SCRAPER_DRY_RUN !== "false";

  console.log(`MercadosPortugues — pipeline diario (${new Date().toISOString()})`);
  console.log(`Adapters: ${adapters.map((a) => a.slug).join(", ")}`);
  console.log(`Fonte: ${dryRun ? "fixtures (SCRAPER_DRY_RUN)" : "sites reais"}`);

  let sink: PriceSink;
  if (useDb) {
    const { PostgresSink } = await import("../core/postgres-sink");
    sink = new PostgresSink();
    console.log("Destino: PostgreSQL");
  } else {
    const { FileCatalogSink } = await import("../core/file-sink");
    sink = new FileCatalogSink();
    console.log("Destino: ficheiro local (data/snapshots/live-catalog.json)");
  }

  const summaries: AdapterRunSummary[] = [];
  for (const adapter of adapters) {
    summaries.push(await runAdapter(adapter, sink, dryRun));
  }

  await sink.finalize();
  printSummary(summaries);

  const failed = summaries.filter((s) => s.status === "failed");
  if (failed.length === summaries.length) {
    console.error("\n✖ Todos os adapters falharam.");
    process.exit(1);
  }
  console.log(
    failed.length
      ? `\n⚠ Pipeline concluido com ${failed.length} falha(s).`
      : "\n✔ Pipeline concluido.",
  );
}

// Permite importar as funcoes em testes sem executar o pipeline.
const isDirectRun =
  typeof process.argv[1] === "string" && /run-daily\.(ts|js|mjs)$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error("Falha fatal no pipeline:", err);
    process.exit(1);
  });
}
