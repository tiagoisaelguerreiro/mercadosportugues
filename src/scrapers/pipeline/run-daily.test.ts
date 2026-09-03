import { describe, expect, it } from "vitest";
import { buildAdapters, parseArgs, runAdapter } from "@/scrapers/pipeline/run-daily";
import { DryRunSink } from "@/scrapers/core/persistence";
import { BaseAdapter } from "@/scrapers/core/base-adapter";
import type { RawProduct } from "@/lib/types";

class ExplodingAdapter extends BaseAdapter {
  readonly slug = "exploding";
  readonly supermarketId = 99;
  async discoverCategories() {
    return ["x"];
  }
  async *fetchCategory(): AsyncIterable<RawProduct> {
    throw new Error("HTTP 503 em /x");
  }
}

describe("run-daily", () => {
  it("parseArgs aceita lista separada por virgulas", () => {
    expect(parseArgs([])).toEqual({ only: undefined });
    expect(parseArgs(["--only=continente"])).toEqual({ only: ["continente"] });
    expect(parseArgs(["--only=continente, auchan"])).toEqual({ only: ["continente", "auchan"] });
  });

  it("buildAdapters filtra por slug e inclui os adapters reais", () => {
    expect(buildAdapters().map((a) => a.slug)).toEqual(["continente", "pingo-doce", "auchan", "mercadona"]);
    expect(buildAdapters(["auchan"]).map((a) => a.slug)).toEqual(["auchan"]);
    expect(buildAdapters(["inexistente"])).toHaveLength(0);
  });

  it("regista uma execucao com sucesso e contagens agregadas", async () => {
    const sink = new DryRunSink();
    const [continente] = buildAdapters(["continente"]);
    const summary = await runAdapter(continente, sink, true);

    expect(summary.status).toBe("success");
    expect(summary.result.received).toBeGreaterThan(0);
    const [run] = sink.getRuns();
    expect(run).toMatchObject({
      supermarketSlug: "continente",
      supermarketId: 1,
      status: "success",
      dryRun: true,
      productsReceived: summary.result.received,
      errorMessage: null,
    });
    expect(run.finishedAt).not.toBeNull();
  });

  it("ignora uma categoria com erro e continua as outras", async () => {
    class MixedAdapter extends BaseAdapter {
      readonly slug = "mixed";
      readonly supermarketId = 98;
      async discoverCategories() {
        return ["ok", "boom"];
      }
      async *fetchCategory(category: string): AsyncIterable<RawProduct> {
        if (category === "boom") throw new Error("HTTP 404 em /boom");
        yield {
          marketSku: "ok-1",
          name: "Leite 1L",
          brand: "Teste",
          ean: "5600000000000",
          priceRegular: 1,
          pricePromo: null,
          hasPromo: false,
          pricePerUnit: 1,
          pricePerUnitUom: "L",
          imageUrl: null,
          productUrl: null,
          categoryPath: "Laticínios",
        };
      }
    }

    const sink = new DryRunSink();
    const summary = await runAdapter(new MixedAdapter(), sink, true);
    expect(summary.status).toBe("success");
    expect(summary.result.received).toBe(1);
  });

  it("isola falhas de um adapter e regista o erro", async () => {
    const sink = new DryRunSink();
    const summary = await runAdapter(new ExplodingAdapter(), sink, true);

    expect(summary.status).toBe("failed");
    expect(summary.error).toContain("HTTP 503");
    const [run] = sink.getRuns();
    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("HTTP 503");
    expect(run.productsReceived).toBe(0);
  });
});
