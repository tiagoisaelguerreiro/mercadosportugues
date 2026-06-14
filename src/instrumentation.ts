/**
 * Instrumentacao do Next.js — corre uma vez no arranque do servidor.
 *
 * Quando USE_DB=true, regista a fabrica do repositorio PostgreSQL. O import e
 * dinamico para que o driver `pg` so seja carregado neste modo (o modo em
 * memoria, por defeito, nao depende de nenhuma infraestrutura).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.USE_DB === "true") {
    const [{ setRepositoryFactory }, { PostgresRepository }] = await Promise.all([
      import("@/db/repository"),
      import("@/db/postgres-repository"),
    ]);
    setRepositoryFactory(() => new PostgresRepository());
  }
}
