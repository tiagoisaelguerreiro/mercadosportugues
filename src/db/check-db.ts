/**
 * Valida que a base de dados PostgreSQL esta pronta para o pipeline e para a app:
 * extensoes, tabelas, materialized view e funcao auxiliar.
 *
 * Uso:
 *   npm run db:check            # usa DATABASE_URL (+ .env local)
 *
 * Sai com codigo 0 se estiver tudo pronto, 1 com mensagem clara caso contrario.
 * Corre no workflow diario ANTES do scrape para falhar cedo em vez de falhar
 * a meio com erros obscuros de SQL.
 */
import { getPool } from "@/db/client";
import { loadDotEnv } from "@/lib/load-dotenv";

export const REQUIRED_TABLES = [
  "supermarkets",
  "categories",
  "products_global",
  "products_market",
  "price_history",
  "scrape_runs",
];

export const REQUIRED_MATVIEWS = ["latest_prices"];
export const REQUIRED_FUNCTIONS = ["ensure_price_partition"];
export const REQUIRED_EXTENSIONS = ["unaccent", "pg_trgm"];

/** Logica pura (testavel): que itens required faltam em found. */
export function findMissing(found: string[], required: string[]): string[] {
  const present = new Set(found);
  return required.filter((name) => !present.has(name));
}

async function tableNames(pool: Awaited<ReturnType<typeof getPool>>): Promise<string[]> {
  const res = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  return res.rows.map((r: { tablename: string }) => r.tablename);
}

async function matviewNames(pool: Awaited<ReturnType<typeof getPool>>): Promise<string[]> {
  const res = await pool.query(
    `SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'`,
  );
  return res.rows.map((r: { matviewname: string }) => r.matviewname);
}

async function functionNames(pool: Awaited<ReturnType<typeof getPool>>): Promise<string[]> {
  const res = await pool.query(
    `SELECT proname FROM pg_proc JOIN pg_namespace ON pg_namespace.oid = pronamespace WHERE nspname = 'public'`,
  );
  return res.rows.map((r: { proname: string }) => r.proname);
}

async function extensionNames(pool: Awaited<ReturnType<typeof getPool>>): Promise<string[]> {
  const res = await pool.query(`SELECT extname FROM pg_extension`);
  return res.rows.map((r: { extname: string }) => r.extname);
}

async function main(): Promise<void> {
  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    console.error(
      "✖ DATABASE_URL nao definido. Configura o secret DATABASE_URL (CI) ou o .env local.",
    );
    process.exit(1);
  }

  const pool = getPool();
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error(`✖ Nao foi possivel ligar a PostgreSQL: ${err instanceof Error ? err.message : err}`);
    await pool.end();
    process.exit(1);
  }

  const errors: string[] = [];
  const [tables, matviews, functions, extensions] = await Promise.all([
    tableNames(pool),
    matviewNames(pool),
    functionNames(pool),
    extensionNames(pool),
  ]);

  for (const missing of findMissing(tables, REQUIRED_TABLES)) {
    errors.push(`tabela em falta: ${missing} (aplica db/schema.sql ou corre as migracoes)`);
  }
  for (const missing of findMissing(matviews, REQUIRED_MATVIEWS)) {
    errors.push(`materialized view em falta: ${missing} (aplica db/schema.sql)`);
  }
  for (const missing of findMissing(functions, REQUIRED_FUNCTIONS)) {
    errors.push(`funcao em falta: ${missing}() (aplica db/schema.sql)`);
  }
  for (const missing of findMissing(extensions, REQUIRED_EXTENSIONS)) {
    errors.push(`extensao em falta: ${missing} (CREATE EXTENSION ${missing})`);
  }

  // Info util: particoes do historico e contagens.
  try {
    const parts = await pool.query(
      `SELECT count(*)::int AS n FROM pg_inherits WHERE inhparent = 'price_history'::regclass`,
    );
    const counts = await pool.query(
      `SELECT (SELECT count(*) FROM supermarkets) AS supermarkets,
              (SELECT count(*) FROM products_global) AS globals,
              (SELECT count(*) FROM products_market) AS offers`,
    );
    const c = counts.rows[0] as { supermarkets: string; globals: string; offers: string };
    console.log(
      `ℹ particoes de price_history: ${parts.rows[0].n} · supermercados=${c.supermarkets} produtos_globais=${c.globals} ofertas=${c.offers}`,
    );
    if (Number(c.supermarkets) === 0) {
      console.log("ℹ base de dados vazia — corre `npm run db:seed` para popular.");
    }
  } catch {
    // Tabelas em falta ja reportadas acima; nao mascarar com erro secundario.
  }

  await pool.end();

  if (errors.length > 0) {
    console.error("✖ Schema incompleto:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("✔ Base de dados pronta (extensoes, tabelas, view e funcao verificadas).");
}

const isDirectRun =
  typeof process.argv[1] === "string" && /check-db\.(ts|js|mjs)$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error("Falha ao validar a base de dados:", err);
    process.exit(1);
  });
}
