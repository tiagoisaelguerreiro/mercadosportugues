import { describe, expect, it } from "vitest";
import {
  discoverLeafCategoryPaths,
  leafUrls,
  limitCategories,
  locToPath,
  parseSitemapLocs,
  pathMatchesPrefixes,
} from "@/scrapers/core/sitemap";

describe("sitemap", () => {
  it("extrai <loc> de um urlset", () => {
    const xml = `
      <urlset>
        <loc>https://www.exemplo.pt/a/</loc>
        <loc>https://www.exemplo.pt/a/b</loc>
      </urlset>
    `;
    expect(parseSitemapLocs(xml)).toEqual([
      "https://www.exemplo.pt/a/",
      "https://www.exemplo.pt/a/b",
    ]);
  });

  it("fica so com categorias folha", () => {
    expect(
      leafUrls([
        "https://loja.pt/mercearia/",
        "https://loja.pt/mercearia/arroz/",
        "https://loja.pt/bebidas",
      ]),
    ).toEqual(["https://loja.pt/bebidas", "https://loja.pt/mercearia/arroz"]);
  });

  it("converte loc no path do site", () => {
    expect(locToPath("https://www.auchan.pt/pt/alimentacao/mercearia/sal/")).toBe(
      "/pt/alimentacao/mercearia/sal/",
    );
  });

  it("filtra departamentos de mercearia", () => {
    expect(pathMatchesPrefixes("/mercearia/arroz/", ["/mercearia/", "/laticinios-e-ovos/"])).toBe(true);
    expect(pathMatchesPrefixes("/oportunidades/livros/", ["/mercearia/"])).toBe(false);
  });

  it("limita a lista quando SCRAPER_MAX_CATEGORIES e positivo", () => {
    expect(limitCategories(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(limitCategories(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
  });

  it("fica so com folhas de mercearia e ignora pesquisa", () => {
    const xml = `
      <urlset>
        <loc>https://loja.pt/mercearia/</loc>
        <loc>https://loja.pt/mercearia/arroz/</loc>
        <loc>https://loja.pt/livros/</loc>
        <loc>https://loja.pt/pesquisa?cgid=mercearia</loc>
      </urlset>
    `;
    expect(discoverLeafCategoryPaths(xml, { pathPrefixes: ["/mercearia/"], skipQuery: true })).toEqual([
      "/mercearia/arroz/",
    ]);
  });
});
