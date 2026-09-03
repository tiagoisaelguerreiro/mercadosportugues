/**
 * Verificacao pos-scrape: garante que a corrida de hoje produziu dados reais.
 *
 * Uso:
 *   npm run scrape:verify        # apos `npm run scrape` com USE_DB=true
 *
 * Falha (exit 1) quando NAO ha atualizacao real — nenhum run com sucesso hoje,
 * zero pontos de preco de hoje, ou runs em dry-run (sinal de ma configuracao).
 * Falhas parciais (um adapter falhou, outros ok) geram aviso mas nao falham,
 * porque houve atualizacao real.
 *
 * Corre no workflow diario DEPOIS do scrape: impede um "sucesso" vazio.
 */
import { getPool } from "@/db/client";
import { loadDotEnv } from "@/lib/load-dotenv";

export interface RunRow {
  supermarketId: number;
  supermarketSlug: string | null;
  supermarketName: string | null;
  status: string;
  productsReceived: number;
  pricePoints: number;
  dryRun: boolean;
  errorMessage: string | null;
}

export interface Verification {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Logica pura (testavel): avalia os runs de hoje + pontos de hoje. */
export function evaluateRuns(runs: RunRow[], pointsToday: number, today: string): Verification {
  const errors: string[] = [];
  const warnings: string[] = [];

  const label = (r: RunRow) => r.supermarketSlug ?? `#${r.supermarketId}`;

  const dryRuns = runs.filter((r) => r.dryRun);
  if (dryRuns.length > 0) {
    errors.push(
      `runs em dry-run detetados (${dryRuns.map(label).join(", ")}) — o workflow deve correr com SCRAPER_DRY_RUN=false para atualizar dados reais.`,
    );
  }

  const succeeded = runs.filter((r) => r.status === "success" && !r.dryRun);
  const failed = runs.filter((r) => r.status !== "success");

  if (succeeded.length === 0) {
    errors.push(
      runs.length === 0
        ? `nenhum run registado em ${today} (scrape_runs vazio para hoje).`
        : `nenhum adapter com sucesso em ${today}.`,
    );
  }
  for (const f of failed) {
    warnings.push(`${label(f)} falhou: ${f.errorMessage ?? "erro desconhecido"}`);
  }
  if (pointsToday <= 0) {
    errors.push(`zero pontos de preco com captured_at=${today} em price_history.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function main(): Promise<void> {
  loadDotEnv();
  if (process.env.USE_DB !== "true" || !process.env.DATABASE_URL) {
    console.error("✖ scrape:verify exige USE_DB=true e DATABASE_URL (dados reais em PostgreSQL).");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const pool = getPool();
  try {
    const runsRes = await pool.query(
      `SELECT r.supermarket_id AS "supermarketId",
              s.slug AS "supermarketSlug",
              s.name AS "supermarketName",
              r.status,
              r.products_received AS "productsReceived",
              r.price_points AS "pricePoints",
              r.dry_run AS "dryRun",
              r.error_message AS "errorMessage"
       FROM scrape_runs r
       LEFT JOIN supermarkets s ON s.id = r.supermarket_id
       WHERE r.started_at >= ($1 || 'T00:00:00Z')::timestamptz
       ORDER BY r.supermarket_id`,
      [today],
    );
    const pointsRes = await pool.query(
      `SELECT count(*)::int AS n FROM price_history WHERE captured_at = $1`,
      [today],
    );

    const runs = runsRes.rows as RunRow[];
    const pointsToday = (pointsRes.rows[0] as { n: number }).n;
    const verdict = evaluateRuns(runs, pointsToday, today);

    console.log(`\n┌ Verificacao do scrape (${today})`);
    for (const r of runs) {
      const icon = r.status === "success" && !r.dryRun ? "✔" : "✖";
      const name = (r.supermarketSlug ?? `#${r.supermarketId}`).padEnd(12);
      console.log(
        `│ ${icon} ${name} ${r.status.padEnd(8)} ${String(r.pricePoints).padStart(6)} precos${r.dryRun ? " (dry-run!)" : ""}`,
      );
    }
    console.log(`│ pontos de preco de hoje em price_history: ${pointsToday}`);
    console.log("└");
    for (const w of verdict.warnings) console.log(`⚠ ${w}`);

    if (!verdict.ok) {
      console.error("✖ Verificacao FALHOU:");
      for (const e of verdict.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log("✔ Verificacao OK: ha dados novos de hoje.");
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && /verify-scrape\.(ts|js|mjs)$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error("Falha ao verificar o scrape:", err);
    process.exit(1);
  });
}
