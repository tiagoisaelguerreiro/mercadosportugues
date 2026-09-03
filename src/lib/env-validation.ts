/**
 * Validacao de variaveis de ambiente criticas.
 *
 * Em producao (NODE_ENV=production) a aplicacao RECUSA arrancar com configuracao
 * insegura — fail-closed em vez de correr com um token admin conhecido/fraco.
 * Em desenvolvimento/testes, apenas reporta os problemas sem lancar.
 */
export const ADMIN_TOKEN_PLACEHOLDER = "trocar-por-um-token-longo";
export const ADMIN_TOKEN_MIN_LENGTH = 32;

export interface EnvIssue {
  variable: string;
  message: string;
}

export function validateAdminToken(token: string | undefined): EnvIssue[] {
  if (!token) {
    return [
      {
        variable: "ADMIN_TOKEN",
        message:
          "ADMIN_TOKEN nao definido. Gera um com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      },
    ];
  }
  if (token === ADMIN_TOKEN_PLACEHOLDER) {
    return [
      {
        variable: "ADMIN_TOKEN",
        message:
          "ADMIN_TOKEN ainda tem o valor placeholder do .env.example. Gera um token forte e substitui.",
      },
    ];
  }
  if (token.length < ADMIN_TOKEN_MIN_LENGTH) {
    return [
      {
        variable: "ADMIN_TOKEN",
        message: `ADMIN_TOKEN demasiado curto (${token.length} caracteres, minimo ${ADMIN_TOKEN_MIN_LENGTH}).`,
      },
    ];
  }
  return [];
}

/**
 * Recolhe todos os problemas de configuracao para producao.
 */
export function collectProductionEnvIssues(
  env: NodeJS.ProcessEnv = process.env,
): EnvIssue[] {
  return [
    ...validateAdminToken(env.ADMIN_TOKEN),
    ...validateDatabaseUrl(env.USE_DB, env.DATABASE_URL),
    ...validateSiteUrl(env.NEXT_PUBLIC_SITE_URL),
  ];
}

/** DATABASE_URL e obrigatorio quando USE_DB=true. */
export function validateDatabaseUrl(
  useDb: string | undefined,
  databaseUrl: string | undefined,
): EnvIssue[] {
  if (useDb === "true" && !databaseUrl) {
    return [
      {
        variable: "DATABASE_URL",
        message:
          "DATABASE_URL nao definido com USE_DB=true. A app nao consegue ligar a PostgreSQL.",
      },
    ];
  }
  return [];
}

/** O URL publico nao pode ser localhost em producao (metadata, sitemap, OG, partilhas). */
export function validateSiteUrl(siteUrl: string | undefined): EnvIssue[] {
  if (!siteUrl) {
    return [
      {
        variable: "NEXT_PUBLIC_SITE_URL",
        message: "NEXT_PUBLIC_SITE_URL nao definido. Ex.: https://precos.exemplo.pt",
      },
    ];
  }
  let host = "";
  try {
    host = new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return [
      {
        variable: "NEXT_PUBLIC_SITE_URL",
        message: `NEXT_PUBLIC_SITE_URL invalido ("${siteUrl}"). Ex.: https://precos.exemplo.pt`,
      },
    ];
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return [
      {
        variable: "NEXT_PUBLIC_SITE_URL",
        message: `NEXT_PUBLIC_SITE_URL aponta para ${host} — em producao tem de ser o dominio publico.`,
      },
    ];
  }
  return [];
}

/** Lanca erro com mensagem clara se a configuracao de producao for invalida. */
export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const issues = collectProductionEnvIssues(env);
  if (issues.length === 0) return;
  const detail = issues.map((i) => `  - ${i.variable}: ${i.message}`).join("\n");
  throw new Error(
    `Configuracao de producao invalida — a aplicacao recusa arrancar:\n${detail}\n` +
      `Define as variaveis no ambiente (ou no .env) e volta a tentar.`,
  );
}
