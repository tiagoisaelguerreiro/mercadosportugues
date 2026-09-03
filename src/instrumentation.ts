/**
 * Instrumentacao do Next.js — corre uma vez no arranque do servidor.
 *
 * 1. Valida a configuracao de producao (fail-closed: recusa arrancar com
 *    ADMIN_TOKEN ausente/fraco — ver src/lib/env-validation.ts).
 * 2. Quando USE_DB=true, regista a fabrica do repositorio PostgreSQL. O import e
 * dinamico para que o driver `pg` so seja carregado neste modo (o modo em
 * memoria, por defeito, nao depende de nenhuma infraestrutura).
 */
export async function register() {
  const { assertProductionEnv } = await import("@/lib/env-validation");
  assertProductionEnv();

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.USE_DB === "true") {
    const [{ setRepositoryFactory }, { PostgresRepository }] = await Promise.all([
      import("@/db/repository"),
      import("@/db/postgres-repository"),
    ]);
    setRepositoryFactory(() => new PostgresRepository());
  }
}
