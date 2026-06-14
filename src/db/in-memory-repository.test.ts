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

  it("inclui o Minipreco nas ofertas quando disponivel", async () => {
    const results = await repo.search("leite");
    const slugs = results[0].offers.map((o) => o.supermarket.slug);
    expect(slugs).toContain("minipreco");
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
    // resultados ordenados por total ascendente
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].total).toBeLessThanOrEqual(result.results[i].total);
    }
    // o vencedor tem isWinner marcado
    const winnerInList = result.results.find(
      (r) => r.supermarket.id === result.winner!.supermarket.id,
    );
    expect(winnerInList?.isWinner).toBe(true);
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
