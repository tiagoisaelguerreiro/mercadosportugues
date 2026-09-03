import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptOffCandidate, buildOffQueries, findEanViaOff } from "@/scrapers/core/openfoodfacts";
import { HttpClient } from "@/scrapers/core/http-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("acceptOffCandidate (criterio estrito)", () => {
  const base = {
    code: "5601234567890",
    product_name: "Leite UHT Meio Gordo Mimosa 1L",
    brands: "Mimosa",
    quantity: "1L",
  };

  it("aceita com marca, tamanho e nome de acordo", () => {
    // Nota: "5601234567890" pode nao ter checksum valido — usa-se EAN real abaixo.
    expect(acceptOffCandidate({ ...base, code: "5601809013014" }, "Leite UHT Meio Gordo Mimosa 1L", "Mimosa")).toBe(
      "5601809013014",
    );
  });

  it("rejeita EAN com checksum invalido", () => {
    expect(acceptOffCandidate({ ...base, code: "5601809013015" }, "Leite UHT Meio Gordo Mimosa 1L", "Mimosa")).toBeNull();
  });

  it("rejeita marca diferente", () => {
    expect(
      acceptOffCandidate(
        { ...base, code: "5601809013014", brands: "Agros" },
        "Leite UHT Meio Gordo Mimosa 1L",
        "Mimosa",
      ),
    ).toBeNull();
  });

  it("rejeita tamanho diferente (veto)", () => {
    expect(
      acceptOffCandidate(
        { ...base, code: "5601809013014", product_name: "Leite UHT Meio Gordo Mimosa 1.5L", quantity: "1.5L" },
        "Leite UHT Meio Gordo Mimosa 1L",
        "Mimosa",
      ),
    ).toBeNull();
  });

  it("rejeita nome muito diferente", () => {
    expect(
      acceptOffCandidate(
        { ...base, code: "5601809013014", product_name: "Iogurte Grego Natural" },
        "Leite UHT Meio Gordo Mimosa 1L",
        "Mimosa",
      ),
    ).toBeNull();
  });

  it("sem marca conhecida exige similaridade muito alta", () => {
    expect(
      acceptOffCandidate({ ...base, code: "5601809013014" }, "Leite UHT Meio Gordo Mimosa 1L", null),
    ).toBe("5601809013014");
    expect(
      acceptOffCandidate({ ...base, code: "5601809013014", product_name: "Leite Meio Gordo" }, "Leite UHT Meio Gordo Mimosa 1L", null),
    ).toBeNull();
  });

  it("nao veta quando so um lado declara tamanho", () => {
    expect(
      acceptOffCandidate(
        { ...base, code: "5601809013014", product_name: "Leite UHT Meio Gordo Mimosa", quantity: "" },
        "Leite UHT Meio Gordo Mimosa",
        "Mimosa",
      ),
    ).toBe("5601809013014");
  });
});

describe("findEanViaOff (com fetch simulado)", () => {
  it("devolve o EAN do primeiro candidato que passa o criterio", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            products: [
              { code: "0000000000000", product_name: "X", brands: "Y" },
              {
                code: "5601809013014",
                product_name: "Leite UHT Meio Gordo Mimosa 1L",
                brands: "Mimosa",
                quantity: "1L",
              },
            ],
          }),
        }) as Response,
    );
    const http = new HttpClient({ minDelayMs: 0, maxDelayMs: 0 });
    await expect(
      findEanViaOff(http, "Leite UHT Meio Gordo Mimosa 1L", "Mimosa"),
    ).resolves.toBe("5601809013014");
  });

  it("devolve null quando nada passa", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        ({ ok: true, status: 200, json: async () => ({ products: [] }) }) as Response,
    );
    const http = new HttpClient({ minDelayMs: 0, maxDelayMs: 0 });
    await expect(findEanViaOff(http, "Produto Xpto 1kg", "Marca")).resolves.toBeNull();
  });
});

describe("buildOffQueries", () => {
  it("gera query completa e versao curta por tokens", () => {
    const queries = buildOffQueries("Leite UHT Meio Gordo Mimosa 1L", "Mimosa");
    expect(queries[0]).toBe("Mimosa Leite UHT Meio Gordo Mimosa 1L");
    expect(queries.length).toBe(2);
    expect(queries[1]).toContain("Mimosa");
    expect(queries[1]).not.toMatch(/1L/i);
  });

  it("corta sufixo de preco por unidade", () => {
    const queries = buildOffQueries("Leite UHT Meio Gordo 1 L | 0,9 €/L", "Mimosa");
    expect(queries[0]).toBe("Mimosa Leite UHT Meio Gordo 1 L");
  });
});
