import { describe, expect, it } from "vitest";
import { buildBrowseHref, parseBrowseSearchParams, toBrowseParams } from "./browse-url";

describe("parseBrowseSearchParams", () => {
  it("normaliza valores em falta e invalidos", () => {
    const state = parseBrowseSearchParams({});
    expect(state).toEqual({ q: "", cat: null, loja: null, promo: false, sort: null, page: 1 });
  });

  it("aceita arrays (usa o primeiro valor) e ignora sort desconhecido", () => {
    const state = parseBrowseSearchParams({
      q: ["  leite ", "x"],
      cat: "laticinios",
      loja: "lidl",
      promo: "1",
      sort: "bogus",
      page: "3",
    });
    expect(state).toEqual({ q: "leite", cat: "laticinios", loja: "lidl", promo: true, sort: null, page: 3 });
  });

  it("rejeita paginas invalidas", () => {
    expect(parseBrowseSearchParams({ page: "-2" }).page).toBe(1);
    expect(parseBrowseSearchParams({ page: "abc" }).page).toBe(1);
    expect(parseBrowseSearchParams({ page: "2.9" }).page).toBe(2);
  });
});

describe("buildBrowseHref", () => {
  const base = parseBrowseSearchParams({ q: "leite", cat: "laticinios", page: "4", sort: "cheapest" });

  it("preserva o estado e omite valores por defeito", () => {
    expect(buildBrowseHref("/pesquisa", base)).toBe("/pesquisa?q=leite&cat=laticinios&sort=cheapest&page=4");
    expect(buildBrowseHref("/pesquisa", parseBrowseSearchParams({}))).toBe("/pesquisa");
  });

  it("repoe a pagina 1 quando um filtro muda", () => {
    expect(buildBrowseHref("/pesquisa", base, { loja: "lidl" })).toBe(
      "/pesquisa?q=leite&cat=laticinios&loja=lidl&sort=cheapest",
    );
  });

  it("mantem a pagina quando so a pagina muda", () => {
    expect(buildBrowseHref("/pesquisa", base, { page: 2 })).toBe("/pesquisa?q=leite&cat=laticinios&sort=cheapest&page=2");
  });

  it("permite omitir chaves fixas pelo caminho (ex.: /categoria/[slug])", () => {
    expect(buildBrowseHref("/categoria/laticinios", base, {}, ["cat"])).toBe(
      "/categoria/laticinios?q=leite&sort=cheapest&page=4",
    );
  });

  it("permite limpar um filtro passando null", () => {
    expect(buildBrowseHref("/pesquisa", base, { cat: null })).toBe("/pesquisa?q=leite&sort=cheapest");
  });
});

describe("toBrowseParams", () => {
  it("combina estado da URL com ids resolvidos e filtros bloqueados", () => {
    const state = parseBrowseSearchParams({ q: "arroz", promo: "0", page: "2" });
    expect(toBrowseParams(state, { categoryId: 7, supermarketSlug: "lidl", onlyPromo: true }, 12)).toEqual({
      query: "arroz",
      categoryId: 7,
      supermarketSlug: "lidl",
      onlyPromo: true,
      sort: undefined,
      page: 2,
      pageSize: 12,
    });
  });

  it("usa promo da URL quando nao esta bloqueado", () => {
    const state = parseBrowseSearchParams({ promo: "1" });
    expect(toBrowseParams(state, {}).onlyPromo).toBe(true);
    expect(toBrowseParams(state, {}).query).toBeUndefined();
  });
});
