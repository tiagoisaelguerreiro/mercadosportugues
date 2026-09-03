import { afterEach, describe, expect, it, vi } from "vitest";
import { adminAuthStatus, tokensEqual } from "@/lib/admin-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("adminAuthStatus", () => {
  it("recusa quando ADMIN_TOKEN nao esta configurado", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(adminAuthStatus("Bearer segredo")).toBe("not_configured");
  });

  it("usa ADMIN_TOKEN do ambiente por omissao", () => {
    vi.stubEnv("ADMIN_TOKEN", "do-ambiente");
    expect(adminAuthStatus("Bearer do-ambiente")).toBe("authorized");
    expect(adminAuthStatus("Bearer outro")).toBe("unauthorized");
  });

  it("aceita Authorization Bearer correto", () => {
    expect(adminAuthStatus("Bearer segredo", "segredo")).toBe("authorized");
  });

  it("recusa token errado", () => {
    expect(adminAuthStatus("Bearer errado", "segredo")).toBe("unauthorized");
  });

  it("recusa header ausente", () => {
    expect(adminAuthStatus(null, "segredo")).toBe("unauthorized");
  });
});

describe("tokensEqual", () => {
  it("iguais passam, diferentes chumbam", () => {
    expect(tokensEqual("segredo", "segredo")).toBe(true);
    expect(tokensEqual("segredo", "errado!")).toBe(false);
  });

  it("comprimentos diferentes chumbam sem lancar", () => {
    expect(tokensEqual("curto", "um-segredo-bem-mais-longo")).toBe(false);
  });

  it("suporta caracteres multibyte", () => {
    expect(tokensEqual("çãõ-123", "çãõ-123")).toBe(true);
    expect(tokensEqual("çãõ-123", "çãõ-124")).toBe(false);
  });
});
