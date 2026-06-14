import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Pool de ligacoes PostgreSQL partilhado (singleton por processo). Evita
 * esgotar ligacoes em ambientes serverless / hot-reload do Next.js.
 */
const globalForDb = globalThis as unknown as {
  __mpPool?: Pool;
  __mpDb?: NodePgDatabase<typeof schema>;
};

export function getPool(): Pool {
  if (!globalForDb.__mpPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL nao definido — necessario quando USE_DB=true.");
    }
    globalForDb.__mpPool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalForDb.__mpPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.__mpDb) {
    globalForDb.__mpDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__mpDb;
}

export { schema };
