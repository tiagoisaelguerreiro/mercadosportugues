/**
 * Orquestrador do pipeline diario de scraping.
 *
 * Uso:
 *   tsx src/scrapers/pipeline/run-daily.ts                 # todos os adapters ativos
 *   tsx src/scrapers/pipeline/run-daily.ts --only=continente
 *
 * Em producao, este script e disparado por um cron (ver
 * .github/workflows/daily-scrape.yml) todos os dias as 04:00.
 */
import { BaseAdapter } from "../core/base-adapter";
import { DryRunSink, type PriceSink } from "../core/persistence";
import { ContinenteAdapter } from "../adapters/continente";
import type { RawProduct } from "@/lib/types";

function buildAdapters(only?: string): BaseAdapter[] {
  const all: BaseAdapter[] = [
    new ContinenteAdapter(),
    // Proximos adapters (mesmo padrao):
    // new PingoDoceAdapter(),
    // new AuchanAdapter(),
    // new LidlAdapter(),
    // new AldiAdapter(),
    // new IntermarcheAdapter(),
  ];
  return only ? all.filter((a) => a.slug === only) : all;
}

function parseArgs(argv: string[]): { only?: string } {
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  return { only: onlyArg?.split("=")[1] };
}

async function runAdapter(adapter: BaseAdapter, sink: PriceSink): Promise<void> {
  const started = Date.now();
  console.log(`\n▶ A correr adapter: ${adapter.slug}`);
  const batch: RawProduct[] = [];
  let count = 0;
  for await (const product of adapter.fetchAll()) {
    batch.push(product);
    count++;
    if (batch.length >= 200) {
      await sink.persistBatch(adapter.supermarketId, batch.splice(0));
    }
  }
  if (batch.length) {
    await sink.persistBatch(adapter.supermarketId, batch.splice(0));
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`✔ ${adapter.slug}: ${count} produtos em ${secs}s`);
}

async function main(): Promise<void> {
  const { only } = parseArgs(process.argv.slice(2));
  const adapters = buildAdapters(only);
  if (adapters.length === 0) {
    console.error(`Nenhum adapter encontrado${only ? ` para "${only}"` : ""}.`);
    process.exit(1);
  }

  // TODO: trocar por PostgresSink quando USE_DB=true.
  const sink: PriceSink = new DryRunSink();

  console.log(`MercadosPortugues — pipeline diario (${new Date().toISOString()})`);
  console.log(`Adapters: ${adapters.map((a) => a.slug).join(", ")}`);

  for (const adapter of adapters) {
    try {
      await runAdapter(adapter, sink);
    } catch (err) {
      console.error(`✖ Erro no adapter ${adapter.slug}:`, err);
    }
  }

  await sink.finalize();
  console.log("\n✔ Pipeline concluido.");
}

main().catch((err) => {
  console.error("Falha fatal no pipeline:", err);
  process.exit(1);
});
