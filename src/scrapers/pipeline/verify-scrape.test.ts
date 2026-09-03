import { describe, expect, it } from "vitest";
import { evaluateRuns, type RunRow } from "@/scrapers/pipeline/verify-scrape";

function run(partial: Partial<RunRow> = {}): RunRow {
  return {
    supermarketId: 1,
    supermarketSlug: "continente",
    supermarketName: "Continente",
    status: "success",
    productsReceived: 100,
    pricePoints: 100,
    dryRun: false,
    errorMessage: null,
    ...partial,
  };
}

describe("evaluateRuns", () => {
  it("ok quando ha sucesso e pontos de hoje", () => {
    const v = evaluateRuns([run(), run({ supermarketId: 2, supermarketSlug: "pingo-doce" })], 200, "2026-01-01");
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it("falha sem runs registados", () => {
    const v = evaluateRuns([], 0, "2026-01-01");
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("nenhum run"))).toBe(true);
  });

  it("falha quando todos falharam", () => {
    const v = evaluateRuns(
      [run({ status: "failed", errorMessage: "HTTP 500", pricePoints: 0 })],
      0,
      "2026-01-01",
    );
    expect(v.ok).toBe(false);
    expect(v.warnings.some((w) => w.includes("HTTP 500"))).toBe(true);
  });

  it("falha com zero pontos de hoje mesmo havendo sucesso", () => {
    const v = evaluateRuns([run({ pricePoints: 0 })], 0, "2026-01-01");
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("zero pontos"))).toBe(true);
  });

  it("falha quando o run foi em dry-run (ma configuracao)", () => {
    const v = evaluateRuns([run({ dryRun: true })], 100, "2026-01-01");
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("dry-run"))).toBe(true);
  });

  it("falha parcial gera aviso mas passa", () => {
    const v = evaluateRuns(
      [run(), run({ supermarketId: 3, supermarketSlug: "aldi", status: "failed", errorMessage: "timeout" })],
      150,
      "2026-01-01",
    );
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => w.includes("aldi"))).toBe(true);
  });
});
