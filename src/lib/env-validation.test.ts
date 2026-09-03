import { describe, expect, it } from "vitest";
import {
  ADMIN_TOKEN_MIN_LENGTH,
  ADMIN_TOKEN_PLACEHOLDER,
  assertProductionEnv,
  collectProductionEnvIssues,
  validateAdminToken,
  validateDatabaseUrl,
  validateSiteUrl,
} from "@/lib/env-validation";

const STRONG = "a".repeat(64);

describe("validateAdminToken", () => {
  it("aceita token forte", () => {
    expect(validateAdminToken(STRONG)).toEqual([]);
  });

  it("rejeita token ausente", () => {
    const issues = validateAdminToken(undefined);
    expect(issues).toHaveLength(1);
    expect(issues[0].variable).toBe("ADMIN_TOKEN");
  });

  it("rejeita o placeholder do .env.example", () => {
    const issues = validateAdminToken(ADMIN_TOKEN_PLACEHOLDER);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/placeholder/i);
  });

  it("rejeita token curto", () => {
    const issues = validateAdminToken("curto");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(String(ADMIN_TOKEN_MIN_LENGTH));
  });

  it("aceita token com exatamente o comprimento minimo", () => {
    expect(validateAdminToken("b".repeat(ADMIN_TOKEN_MIN_LENGTH))).toEqual([]);
  });
});

describe("assertProductionEnv", () => {
  it("nao faz nada fora de producao", () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: "development", ADMIN_TOKEN: undefined }),
    ).not.toThrow();
    expect(() =>
      assertProductionEnv({ NODE_ENV: "test", ADMIN_TOKEN: ADMIN_TOKEN_PLACEHOLDER }),
    ).not.toThrow();
  });

  it("lanca em producao com token em falta", () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: "production", ADMIN_TOKEN: undefined }),
    ).toThrow(/ADMIN_TOKEN/);
  });

  it("lanca em producao com placeholder", () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: "production", ADMIN_TOKEN: ADMIN_TOKEN_PLACEHOLDER }),
    ).toThrow(/placeholder/);
  });

  it("nao lanca em producao com configuracao completa", () => {
    expect(() =>
      assertProductionEnv({
        NODE_ENV: "production",
        ADMIN_TOKEN: STRONG,
        NEXT_PUBLIC_SITE_URL: "https://precos.exemplo.pt",
      }),
    ).not.toThrow();
  });
});

describe("collectProductionEnvIssues", () => {
  it("devolve lista vazia quando esta tudo bem", () => {
    expect(
      collectProductionEnvIssues({
        NODE_ENV: "production",
        ADMIN_TOKEN: STRONG,
        USE_DB: "true",
        DATABASE_URL: "postgresql://u:p@host:5432/db",
        NEXT_PUBLIC_SITE_URL: "https://precos.exemplo.pt",
      }),
    ).toEqual([]);
  });

  it("acumula varios problemas", () => {
    const issues = collectProductionEnvIssues({
      NODE_ENV: "production",
      ADMIN_TOKEN: "curto",
      USE_DB: "true",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
    const vars = issues.map((i) => i.variable).sort();
    expect(vars).toEqual(["ADMIN_TOKEN", "DATABASE_URL", "NEXT_PUBLIC_SITE_URL"]);
  });
});

describe("validateDatabaseUrl", () => {
  it("exige DATABASE_URL com USE_DB=true", () => {
    expect(validateDatabaseUrl("true", undefined)).toHaveLength(1);
    expect(validateDatabaseUrl("true", "postgresql://x")).toEqual([]);
  });

  it("nao exige nada sem USE_DB", () => {
    expect(validateDatabaseUrl(undefined, undefined)).toEqual([]);
    expect(validateDatabaseUrl("false", undefined)).toEqual([]);
  });
});

describe("validateSiteUrl", () => {
  it("aceita dominio publico", () => {
    expect(validateSiteUrl("https://precos.exemplo.pt")).toEqual([]);
  });

  it("rejeita ausente, invalido e localhost", () => {
    expect(validateSiteUrl(undefined)[0].variable).toBe("NEXT_PUBLIC_SITE_URL");
    expect(validateSiteUrl("nao-um-url")[0].variable).toBe("NEXT_PUBLIC_SITE_URL");
    expect(validateSiteUrl("http://localhost:3000")[0].message).toMatch(/localhost/);
    expect(validateSiteUrl("http://127.0.0.1:3000")).toHaveLength(1);
  });
});
