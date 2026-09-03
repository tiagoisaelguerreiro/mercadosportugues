import { describe, expect, it } from "vitest";
import { MercadonaAdapter, collectLeafCategoryIds } from "@/scrapers/adapters/mercadona";
import type { HttpClient } from "@/scrapers/core/http-client";
import type { RawProduct } from "@/lib/types";

describe("collectLeafCategoryIds", () => {
  it("fica so com nos sem filhos", () => {
    expect(
      collectLeafCategoryIds([
        {
          id: 1,
          categories: [
            { id: 11, categories: [{ id: 111 }] },
            { id: 12 },
          ],
        },
        { id: 2 },
      ]),
    ).toEqual(["111", "12", "2"]);
  });
});

describe("MercadonaAdapter", () => {
  it("em dry-run devolve a fixture de leite", async () => {
    const products: RawProduct[] = [];
    for await (const p of new MercadonaAdapter({ dryRun: true }).fetchAll()) products.push(p);
    expect(products).toHaveLength(1);
    expect(products[0].name).toMatch(/leite/i);
  });

  it("descobre todas as categorias-folha da API", async () => {
    const http = {
      getJson: async () => ({
        results: [
          { id: 10, categories: [{ id: 101 }, { id: 102, categories: [{ id: 1021 }] }] },
        ],
      }),
    } as unknown as HttpClient;
    await expect(new MercadonaAdapter({ dryRun: false, http }).discoverCategories()).resolves.toEqual([
      "101",
      "1021",
    ]);
  });
});
