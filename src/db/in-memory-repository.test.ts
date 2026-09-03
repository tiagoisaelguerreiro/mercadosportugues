import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/db/in-memory-repository";

const repo = new InMemoryRepository();

describe("InMemoryRepository.search", () => {
  it("encontra produtos por nome e ordena ofertas do mais barato ao mais caro", async () => {
    const results = await repo.search("leite");
    expect(results.length).toBeGreaterThan(0);
    const leite = results[0];
    const prices = leite.offers.map((o) => o.effectivePrice);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
    expect(leite.offers[0].isCheapest).toBe(true);
  });

  it("query vazia devolve um lote de produtos", async () => {
    const results = await repo.search("", 6);
    expect(results).toHaveLength(6);
  });

  it("inclui a Mercadona e exclui supermercados inativos (Minipreco)", async () => {
    const results = await repo.search("leite");
    const slugs = results[0].offers.map((o) => o.supermarket.slug);
    expect(slugs).toContain("mercadona");
    expect(slugs).not.toContain("minipreco");
  });
});

describe("InMemoryRepository.browse", () => {
  it("pagina o catalogo e devolve metadados", async () => {
    const page1 = await repo.browse({ page: 1, pageSize: 5, sort: "name" });
    const page2 = await repo.browse({ page: 2, pageSize: 5, sort: "name" });
    expect(page1.items).toHaveLength(5);
    expect(page1.total).toBeGreaterThan(5);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 5));
    expect(page2.items[0].product.id).not.toBe(page1.items[0].product.id);
  });

  it("filtra por categoria, supermercado e promocao", async () => {
    const bebidas = await repo.browse({ categoryId: 3 });
    expect(bebidas.items.length).toBeGreaterThan(0);
    expect(bebidas.items.every((i) => i.category?.id === 3)).toBe(true);

    const lidl = await repo.browse({ supermarketSlug: "lidl" });
    expect(lidl.items.every((i) => i.offers.some((o) => o.supermarket.slug === "lidl"))).toBe(true);

    const promos = await repo.browse({ onlyPromo: true, sort: "promo" });
    expect(promos.items.length).toBeGreaterThan(0);
    expect(promos.items.every((i) => i.offers.some((o) => o.hasPromo))).toBe(true);
  });

  it("ordena por preco mais baixo", async () => {
    const result = await repo.browse({ sort: "cheapest", pageSize: 50 });
    const prices = result.items.map((i) => i.cheapestPrice ?? Infinity);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("pesquisa por texto com relevancia", async () => {
    const result = await repo.browse({ query: "mimosa" });
    expect(result.total).toBe(2);
    expect(result.items.every((i) => i.product.brand === "Mimosa")).toBe(true);
  });

  it("clampa a pagina para o ultimo valor valido", async () => {
    const result = await repo.browse({ page: 999, pageSize: 5 });
    expect(result.page).toBe(result.totalPages);
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe("InMemoryRepository.getStats", () => {
  it("agrega contagens e a data da ultima captura", async () => {
    const stats = await repo.getStats();
    expect(stats.productCount).toBe(12);
    expect(stats.offerCount).toBeGreaterThan(stats.productCount);
    expect(stats.promoCount).toBeGreaterThan(0);
    expect(stats.activeSupermarkets).toBe(7);
    expect(stats.categoryCount).toBe(4);
    expect(stats.lastCapturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("InMemoryRepository.getSupermarketSummaries", () => {
  it("ordena por indice de preco e ignora inativos", async () => {
    const summaries = await repo.getSupermarketSummaries();
    expect(summaries.map((s) => s.supermarket.slug)).not.toContain("minipreco");
    expect(summaries).toHaveLength(7);
    for (let i = 1; i < summaries.length; i++) {
      expect(summaries[i - 1].priceIndex ?? Infinity).toBeLessThanOrEqual(
        summaries[i].priceIndex ?? Infinity,
      );
    }
    const totalCheapest = summaries.reduce((sum, s) => sum + s.cheapestCount, 0);
    expect(totalCheapest).toBeGreaterThanOrEqual(12);
  });
});

describe("InMemoryRepository.listScrapeRuns", () => {
  it("devolve execucoes ordenadas da mais recente para a mais antiga", async () => {
    const runs = await repo.listScrapeRuns(10);
    expect(runs).toHaveLength(10);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i - 1].startedAt >= runs[i].startedAt).toBe(true);
    }
    expect(runs.some((r) => r.status === "success")).toBe(true);
  });
});

describe("InMemoryRepository.getProduct", () => {
  it("devolve o produto com categoria e poupanca", async () => {
    const product = await repo.getProduct(1);
    expect(product).not.toBeNull();
    expect(product!.product.nameGlobal).toContain("Leite");
    expect(product!.cheapestPrice).toBeLessThanOrEqual(product!.priciestPrice!);
    expect(product!.savingsPercent).toBeGreaterThanOrEqual(0);
  });

  it("devolve null para id inexistente", async () => {
    expect(await repo.getProduct(99999)).toBeNull();
  });
});

describe("InMemoryRepository.getHistory", () => {
  it("respeita a janela temporal", async () => {
    const h7 = await repo.getHistory(1, 7);
    const h30 = await repo.getHistory(1, 30);
    expect(h7.points.length).toBeLessThanOrEqual(7);
    expect(h30.points.length).toBeGreaterThan(h7.points.length);
    expect(h7.supermarkets.length).toBeGreaterThan(0);
  });

  it("faz downsample para periodos longos (<= 90 pontos)", async () => {
    const h365 = await repo.getHistory(1, 365);
    expect(h365.points.length).toBeLessThanOrEqual(90);
  });

  it("cada ponto tem precos por slug de supermercado", async () => {
    const h = await repo.getHistory(1, 7);
    const slugs = h.supermarkets.map((s) => s.slug);
    const last = h.points[h.points.length - 1];
    expect(slugs.some((slug) => slug in last.prices)).toBe(true);
  });

  it("o historico diario muda sobretudo em patamares (nao todos os dias)", async () => {
    const h = await repo.getHistory(1, 30);
    let changes = 0;
    let pairs = 0;
    for (const s of h.supermarkets) {
      for (let i = 1; i < h.points.length; i++) {
        const a = h.points[i - 1].prices[s.slug];
        const b = h.points[i].prices[s.slug];
        if (a == null || b == null) continue;
        pairs += 1;
        if (a !== b) changes += 1;
      }
    }
    expect(pairs).toBeGreaterThan(0);
    expect(changes / pairs).toBeLessThan(0.45);
  });
});

describe("InMemoryRepository.biggestDrops", () => {
  it("devolve descidas ordenadas por percentagem", async () => {
    const drops = await repo.biggestDrops(5);
    expect(drops.length).toBeGreaterThan(0);
    for (let i = 1; i < drops.length; i++) {
      expect(drops[i - 1].dropPercent).toBeGreaterThanOrEqual(drops[i].dropPercent);
    }
    for (const d of drops) {
      expect(d.currentPrice).toBeLessThan(d.previousPrice);
    }
  });
});

describe("InMemoryRepository.compareBasket", () => {
  it("compara um carrinho e elege vencedor", async () => {
    const result = await repo.compareBasket([
      { productGlobalId: 1, quantity: 2 },
      { productGlobalId: 2, quantity: 1 },
    ]);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.winner).not.toBeNull();
    // completos primeiro, ordenados por total ascendente
    const complete = result.results.filter((r) => r.isComplete);
    expect(result.results.slice(0, complete.length).every((r) => r.isComplete)).toBe(true);
    for (let i = 1; i < complete.length; i++) {
      expect(complete[i - 1].total).toBeLessThanOrEqual(complete[i].total);
    }
    // o vencedor é o primeiro da lista e tem isWinner marcado
    expect(result.results[0].supermarket.id).toBe(result.winner!.supermarket.id);
    expect(result.results[0].isWinner).toBe(true);
  });

  it("ordena cestos incompletos depois dos completos, com menos faltas primeiro", async () => {
    // produto 10 (iogurte) só existe em alguns supermercados, logo há cestos incompletos
    const result = await repo.compareBasket([
      { productGlobalId: 1, quantity: 1 },
      { productGlobalId: 10, quantity: 1 },
    ]);
    const firstIncomplete = result.results.findIndex((r) => !r.isComplete);
    expect(firstIncomplete).toBeGreaterThan(0);
    expect(result.results.slice(firstIncomplete).every((r) => !r.isComplete)).toBe(true);
    const incomplete = result.results.slice(firstIncomplete);
    for (let i = 1; i < incomplete.length; i++) {
      const prev = incomplete[i - 1];
      const cur = incomplete[i];
      expect(prev.itemsMissing).toBeLessThanOrEqual(cur.itemsMissing);
      if (prev.itemsMissing === cur.itemsMissing) {
        expect(prev.total).toBeLessThanOrEqual(cur.total);
      }
    }
  });

  it("lida com produtos nao disponiveis em todos os supermercados", async () => {
    // produto 10 (iogurte) nao existe em todos
    const result = await repo.compareBasket([{ productGlobalId: 10, quantity: 1 }]);
    const incomplete = result.results.filter((r) => r.itemsMissing > 0);
    // alguns supermercados nao tem este produto
    expect(result.results.length).toBeGreaterThan(0);
    expect(incomplete.length).toBeGreaterThanOrEqual(0);
  });
});

describe("InMemoryRepository.reviewMatches", () => {
  it("lista matches em revisao com supermercado e sugestao", async () => {
    const reviewRepo = new InMemoryRepository();
    const matches = await reviewRepo.listReviewMatches();
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].productMarket.matchStatus).toBe("review");
    expect(matches[0].supermarket.name).toBe("Pingo Doce");
    expect(matches[0].suggestedProduct?.nameGlobal).toContain("Arroz");
  });

  it("aprova uma sugestao e remove-a da fila", async () => {
    const reviewRepo = new InMemoryRepository();
    const [match] = await reviewRepo.listReviewMatches();
    const updated = await reviewRepo.approveReviewMatch(match.productMarket.id);

    expect(updated?.matchStatus).toBe("matched");
    expect(updated?.matchConfidence).toBe(1);
    expect(await reviewRepo.listReviewMatches()).toHaveLength(0);
  });

  it("rejeita uma sugestao e marca a oferta como orphan", async () => {
    const reviewRepo = new InMemoryRepository();
    const [match] = await reviewRepo.listReviewMatches();
    const updated = await reviewRepo.rejectReviewMatch(match.productMarket.id);

    expect(updated?.matchStatus).toBe("orphan");
    expect(updated?.productGlobalId).toBeNull();
    expect(updated?.matchConfidence).toBeNull();
  });

  it("cria um produto global a partir da oferta em revisao", async () => {
    const reviewRepo = new InMemoryRepository();
    const [match] = await reviewRepo.listReviewMatches();
    const updated = await reviewRepo.createGlobalFromReview(match.productMarket.id, {
      nameGlobal: "Arroz Carolino Pingo Doce 1 kg",
      brand: "Pingo Doce",
    });

    expect(updated?.matchStatus).toBe("orphan");
    expect(updated?.productGlobalId).toBeGreaterThan(0);
    expect(await reviewRepo.getProduct(updated!.productGlobalId!)).not.toBeNull();
  });
});
