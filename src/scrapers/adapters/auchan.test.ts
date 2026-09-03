import { describe, expect, it } from "vitest";
import { AuchanAdapter, parseAuchanGridHtml } from "@/scrapers/adapters/auchan";
import type { RawProduct } from "@/lib/types";
import type { HttpClient } from "@/scrapers/core/http-client";

const GRID_HTML = `
<div class="product-grid">
  <div class="col-6 col-sm-4 product" data-pid="3345671">
    <div class="product-tile auc-product-tile"
      data-gtm-product='{&quot;id&quot;:&quot;3345671&quot;,&quot;name&quot;:&quot;Leite UHT Meio Gordo Mimosa&quot;,&quot;brand&quot;:&quot;Mimosa&quot;,&quot;category&quot;:&quot;Alimenta&ccedil;&atilde;o/Latic&iacute;nios/Leite&quot;,&quot;price&quot;:0.9,&quot;ean&quot;:&quot;5601010000017&quot;}'>
      <div class="image-container">
        <a href="/leite-uht-meio-gordo-mimosa-1l/3345671.html">
          <img class="tile-image" src="https://www.auchan.pt/dw/image/v2/leite.jpg?sw=300" alt="Leite" />
        </a>
      </div>
      <div class="tile-body">
        <div class="auc-product-tile__brand">Mimosa</div>
        <div class="pdp-link">
          <a class="link" href="/leite-uht-meio-gordo-mimosa-1l/3345671.html">Leite UHT Meio Gordo Mimosa</a>
        </div>
        <div class="auc-product-tile__quantity">emb. 1 L</div>
        <div class="price">
          <span class="strike-through list">
            <span class="value" content="0.93">0,93 &euro;</span>
          </span>
          <span class="sales">
            <span class="value" content="0.90">0,90 &euro;</span>
          </span>
        </div>
        <div class="auc-measures--price-per-unit">0,90 &euro;/lt</div>
      </div>
    </div>
  </div>
  <div class="col-6 col-sm-4 product" data-pid="7788990">
    <div class="product-tile auc-product-tile">
      <div class="image-container">
        <a href="/arroz-agulha-cigala-1kg/7788990.html">
          <img class="tile-image" data-src="https://www.auchan.pt/dw/image/v2/arroz.jpg?sw=300" alt="Arroz" />
        </a>
      </div>
      <div class="tile-body">
        <div class="pdp-link">
          <a class="link" href="/arroz-agulha-cigala-1kg/7788990.html">Arroz Agulha Cigala 1 kg</a>
        </div>
        <div class="price">
          <span class="sales">
            <span class="value" content="1.42">1,42 &euro;</span>
          </span>
        </div>
      </div>
    </div>
  </div>
  <div class="show-more"><button data-url="...">Ver mais</button></div>
</div>
`;

async function collect(adapter: AuchanAdapter, category = "mercearia"): Promise<RawProduct[]> {
  const out: RawProduct[] = [];
  for await (const p of adapter.fetchCategory(category)) out.push(p);
  return out;
}

describe("AuchanAdapter", () => {
  it("extrai tiles SFRA da grelha", () => {
    const items = parseAuchanGridHtml(GRID_HTML);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "3345671",
      name: "Leite UHT Meio Gordo Mimosa",
      brand: "Mimosa",
      ean: "5601010000017",
      listPrice: 0.93,
      salePrice: 0.9,
      pricePerUnit: "0,90 €/lt",
      quantityText: "emb. 1 L",
      category: "Alimentação/Laticínios/Leite",
    });
    expect(items[0].imageUrl).toContain("leite.jpg");
    expect(items[1]).toMatchObject({ id: "7788990", salePrice: 1.42 });
    expect(items[1].listPrice).toBeUndefined();
    expect(items[1].imageUrl).toContain("arroz.jpg");
  });

  it("normaliza para RawProduct com promocao, EAN e preco por unidade", async () => {
    const http = { getText: async () => GRID_HTML } as unknown as HttpClient;
    const products = await collect(new AuchanAdapter({ dryRun: false, http }));

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      marketSku: "3345671",
      name: "Leite UHT Meio Gordo Mimosa 1 L",
      brand: "Mimosa",
      ean: "5601010000017",
      priceRegular: 0.93,
      pricePromo: 0.9,
      hasPromo: true,
      pricePerUnit: 0.9,
      pricePerUnitUom: "L",
      productUrl: "https://www.auchan.pt/leite-uht-meio-gordo-mimosa-1l/3345671.html",
    });
    expect(products[1]).toMatchObject({
      marketSku: "7788990",
      name: "Arroz Agulha Cigala 1 kg",
      priceRegular: 1.42,
      pricePromo: null,
      hasPromo: false,
      pricePerUnit: 1.42,
      pricePerUnitUom: "kg",
    });
  });

  it("em dry-run produz fixtures com EAN partilhado para exercitar o matching", async () => {
    const adapter = new AuchanAdapter({ dryRun: true });
    const categories = await adapter.discoverCategories();
    expect(categories).toContain("laticinios");

    const products = await collect(adapter, "laticinios");
    expect(products.length).toBeGreaterThan(0);
    expect(products.map((p) => p.ean)).toContain("5601010000017");
    expect(products.every((p) => p.priceRegular > 0)).toBe(true);
  });

  it("descobre categorias-folha de alimentacao a partir do sitemap", async () => {
    const xml = `
      <urlset>
        <loc>https://www.auchan.pt/pt/alimentacao/</loc>
        <loc>https://www.auchan.pt/pt/alimentacao/mercearia/sal/</loc>
        <loc>https://www.auchan.pt/pt/tecnologia/gaming/</loc>
        <loc>https://www.auchan.pt/pesquisa?cgid=mercearia</loc>
      </urlset>
    `;
    const http = { getText: async () => xml } as unknown as HttpClient;
    await expect(new AuchanAdapter({ dryRun: false, http }).discoverCategories()).resolves.toEqual([
      "/pt/alimentacao/mercearia/sal/",
    ]);
  });

  it("pagina com ?start= quando a primeira pagina esta cheia", async () => {
    const starts: Array<number | undefined> = [];
    const http = {
      getText: async (_url: string, params?: Record<string, string | number>) => {
        starts.push(params?.start as number | undefined);
        if (params?.start) return "<div></div>";
        return GRID_HTML;
      },
    } as unknown as HttpClient;
    const products = await collect(new AuchanAdapter({ dryRun: false, http, pageSize: 2 }));
    expect(starts).toEqual([undefined, 2]);
    expect(products).toHaveLength(2);
  });

  it("le preco riscado real com spans .sr-only aninhados (markup www.auchan.pt)", () => {
    const html = `
<div class="product-tile product" data-pid="999">
  <a class="pdp-link" href="/pt/arroz/999.html">Arroz Agulha 1kg</a>
  <div class="auc-measures">
    <span class="auc-measures--price-per-unit">1.25 &euro;/Kg</span>
  </div>
  <div class="auc-product-tile__prices">
    <div class="price"><span>
      <div class="auc-price__stricked">
        <span class="list">
          <span class="strike-through value" content="1.64">
            <span class="sr-only">Price reduced from</span>
            1,64 &euro;
            <span class="sr-only">to</span>
          </span>
        </span>
      </div>
      <span class="sales">
        <span class="value" content="1.25">
          1,25 &euro;
        </span>
      </span>
    </span></div>
  </div>
</div>`;
    const items = parseAuchanGridHtml(html);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "999",
      listPrice: 1.64,
      salePrice: 1.25,
    });
  });
});
