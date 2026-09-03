import { describe, expect, it } from "vitest";
import { relinkCatalog } from "@/lib/relink-catalog";
import type { LiveCatalog } from "@/db/live-catalog";
import type { ProductGlobal, ProductMarket } from "@/lib/types";

function market(partial: Partial<ProductMarket> & Pick<ProductMarket, "id" | "supermarketId" | "nameMarket">): ProductMarket {
  return {
    productGlobalId: "productGlobalId" in partial ? partial.productGlobalId ?? null : partial.id,
    marketSku: `sku-${partial.id}`,
    productUrl: partial.productUrl ?? null,
    imageUrl: null,
    rawEan: partial.rawEan ?? null,
    brandMarket: partial.brandMarket ?? null,
    matchStatus: "orphan",
    matchConfidence: 0,
    lastSeenAt: null,
    ...partial,
  };
}

function catalog(markets: ProductMarket[]): LiveCatalog {
  const productsGlobal: ProductGlobal[] = markets.map((m) => ({
    id: m.productGlobalId ?? m.id,
    nameGlobal: m.nameMarket,
    brand: m.brandMarket ?? null,
    eanCode: m.rawEan,
    categoryId: 1,
    imageUrl: null,
    quantityValue: null,
    quantityUnit: null,
    baseUnit: null,
    baseQuantity: null,
  }));
  return {
    version: 1,
    scrapedAt: new Date().toISOString(),
    productsGlobal,
    productsMarket: markets,
    priceHistory: [],
    scrapeRuns: [],
  };
}

describe("relinkCatalog (clustering)", () => {
  it("junta Mimosa em 3 lojas mesmo com nomes diferentes e marca so no URL", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          nameMarket: "Leite UHT Meio Gordo Mimosa 1 lt",
          brandMarket: "Mimosa",
        }),
        market({
          id: 2,
          supermarketId: 2,
          nameMarket: "Leite UHT Meio Gordo 1 L | 0,9 €/L",
          brandMarket: "Pingo Doce",
          productUrl: "https://www.pingodoce.pt/home/produtos/leite-uht-meio-gordo-mimosa-41043.html",
        }),
        market({
          id: 3,
          supermarketId: 6,
          nameMarket: "leite mimosa uht meio gordo 1l",
          brandMarket: null,
        }),
      ]),
    );
    expect(linked.productsGlobal).toHaveLength(1);
    expect(new Set(linked.productsMarket.map((m) => m.productGlobalId)).size).toBe(1);
    expect(linked.productsGlobal[0].brand).toBe("Mimosa");
    expect(linked.productsGlobal[0].nameGlobal.toLowerCase()).toContain("mimosa");
  });

  it("nao mistura Mimosa com leite de marca propria", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          nameMarket: "Leite UHT Meio Gordo Mimosa 1 lt",
          brandMarket: "Mimosa",
        }),
        market({
          id: 2,
          supermarketId: 2,
          nameMarket: "Leite UHT Meio Gordo 1 L | 0,86 €/L",
          brandMarket: "Pingo Doce",
          productUrl: "https://www.pingodoce.pt/home/produtos/leite-uht-meio-gordo-pingo-doce-1.html",
        }),
      ]),
    );
    expect(linked.productsGlobal).toHaveLength(2);
  });

  it("e transitivo: A=B e B=C implica um so produto", () => {
    const linked = relinkCatalog(
      catalog([
        market({ id: 1, supermarketId: 1, nameMarket: "Arroz Agulha Cigala 1 kg", brandMarket: "Cigala" }),
        market({ id: 2, supermarketId: 6, nameMarket: "arroz agulha cigala 1kg", brandMarket: "Cigala" }),
        market({
          id: 3,
          supermarketId: 2,
          nameMarket: "Arroz Agulha 1 Kg | 1,25 €/Kg",
          brandMarket: "Cigala",
          productUrl: "https://www.pingodoce.pt/produto/arroz-agulha-cigala-1kg",
        }),
      ]),
    );
    expect(linked.productsGlobal).toHaveLength(1);
  });

  it("nao junta arroz de marca propria de lojas diferentes", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          nameMarket: "Arroz Agulha Selecionado Continente 1 kg",
          brandMarket: "Continente",
        }),
        market({
          id: 2,
          supermarketId: 6,
          nameMarket: "arroz agulha auchan extra longo branqueado 1kg",
          brandMarket: null,
        }),
      ]),
    );
    expect(linked.productsGlobal).toHaveLength(2);
  });

  it("liga Heineken pack 24 com 24 x 25 cl mesmo em blocos de tamanho diferentes", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          nameMarket: "Cerveja com Álcool Heineken 24 x 25 cl",
          brandMarket: "Heineken",
        }),
        market({
          id: 2,
          supermarketId: 2,
          nameMarket: "Cerveja com Álcool Pack 24",
          brandMarket: null,
          productUrl: "https://www.pingodoce.pt/home/produtos/cerveja-com-alcool-pack-24-heineken-840092.html",
        }),
      ]),
    );
    expect(linked.productsGlobal).toHaveLength(1);
  });
});

describe("relinkCatalog (decisoes manuais)", () => {
  it("mantem par aprovado junto mesmo que o fuzzy os separasse", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          productGlobalId: 99,
          nameMarket: "Leite UHT Meio Gordo Mimosa 1L",
          brandMarket: "Mimosa",
          matchStatus: "matched",
          matchConfidence: 1,
          matchLocked: true,
        }),
        market({
          id: 2,
          supermarketId: 2,
          productGlobalId: 99,
          nameMarket: "Iogurte Grego Natural 500g",
          brandMarket: "Nova",
          matchStatus: "matched",
          matchConfidence: 1,
          matchLocked: true,
        }),
      ]),
    );
    const byId = new Map(linked.productsMarket.map((m) => [m.id, m]));
    // Nomes nada a ver, mas o admin decidiu: continuam no mesmo global.
    expect(byId.get(1)!.productGlobalId).toBe(byId.get(2)!.productGlobalId);
    expect(byId.get(1)!.matchLocked).toBe(true);
    expect(linked.productsGlobal).toHaveLength(1);
  });

  it("rejeitado bloqueado fica orfao sem global", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          productGlobalId: null,
          nameMarket: "Leite UHT Meio Gordo Mimosa 1L",
          matchStatus: "orphan",
          matchLocked: true,
        }),
      ]),
    );
    expect(linked.productsMarket[0].productGlobalId).toBeNull();
    expect(linked.productsMarket[0].matchStatus).toBe("orphan");
  });

  it("singleton ex-review mantem-se em revisao (nao vira orphan)", () => {
    const linked = relinkCatalog(
      catalog([
        market({
          id: 1,
          supermarketId: 1,
          nameMarket: "Produto Totalmente Unico Xyz 123",
          matchStatus: "review",
          matchConfidence: 0.85,
        }),
      ]),
    );
    expect(linked.productsMarket[0].matchStatus).toBe("review");
    expect(linked.productsMarket[0].matchConfidence).toBe(0.85);
  });
});
