import { describe, expect, it } from "vitest";
import { ContinenteAdapter, parseContinenteGridHtml } from "@/scrapers/adapters/continente";
import type { RawProduct } from "@/lib/types";
import type { HttpClient } from "@/scrapers/core/http-client";

const GRID_HTML = `
<span class="page-placeholder-0" data-start="0" data-size="35.0"></span>
<div class="productTile" data-idx="1">
  <div class="product" data-pid="5253941">
    <div class="product-tile"
      data-product-tile-impression='{&quot;name&quot;:&quot;Massa Esparguete Pack Poupan&ccedil;a Continente&quot;,&quot;id&quot;:&quot;5253941&quot;,&quot;price&quot;:0.99,&quot;brand&quot;:&quot;Continente&quot;,&quot;category&quot;:&quot;Mercearia/Arroz, Massa e Farinha/Massa&quot;,&quot;variant&quot;:&quot;&quot;,&quot;channel&quot;:&quot;col&quot;}'>
      <div class="ct-image-container" data-confirmation-image="{&quot;url&quot;:&quot;https://www.continente.pt/dw/image/v2/BDVS_PRD/on/demandware.static/-/Sites-col-master-catalog/default/dw01/images/col/525/5253941-frente.jpg?sw=87&amp;sh=80&quot;}">
        <a class="image-link pb-1" href="https://www.continente.pt/produto/massa-esparguete-pack-poupanca-continente-continente-5253941.html">
          <img data-src="https://www.continente.pt/dw/image/v2/BDVS_PRD/on/demandware.static/-/Sites-col-master-catalog/default/dw01/images/col/525/5253941-frente.jpg?sw=280&amp;sh=280" />
        </a>
      </div>
      <h2 class="pwc-tile--description">Massa Esparguete Pack Poupan&ccedil;a Continente</h2>
      <p class="pwc-tile--quantity">emb. 1 kg</p>
      <span class="pwc-tile--price-primary">0<span class="decimalPrice">,99&euro;</span></span>
      <div class="pwc-tile--price-secondary">0,99&euro;/kg</div>
      <div class="pwc-tile--price-sdr"></div>
    </div>
  </div>
</div>
<div class="productTile" data-idx="2">
  <div class="product" data-pid="7314143">
    <div class="product-tile"
      data-product-tile-impression='{&quot;name&quot;:&quot;Atum ao Natural Trit&atilde;o&quot;,&quot;id&quot;:&quot;7314143&quot;,&quot;price&quot;:0.79,&quot;brand&quot;:&quot;Trit&atilde;o&quot;,&quot;category&quot;:&quot;Mercearia/Conservas/Atum&quot;,&quot;variant&quot;:&quot;&quot;,&quot;channel&quot;:&quot;col&quot;}'>
      <div class="ct-image-container" data-confirmation-image="{&quot;url&quot;:&quot;https://www.continente.pt/dw/image/v2/BDVS_PRD/on/demandware.static/-/Sites-col-master-catalog/default/dw02/images/col/731/7314143-cima.jpg?sw=87&amp;sh=80&quot;}">
        <a href="https://www.continente.pt/produto/atum-ao-natural-tritao-tritao-7314143.html">Atum</a>
      </div>
      <h2 class="pwc-tile--description">Atum ao Natural Trit&atilde;o</h2>
      <p class="pwc-tile--quantity">emb. 110 gr (peso escorrido 77 gr)</p>
      <span class="strike-through pwc-tile--price-dashed">
        <span class="value pwc-tile--price-value" content="0.79">0,87&euro;</span>
      </span>
      <span class="pwc-tile--price-primary">0<span class="decimalPrice">,79&euro;</span></span>
      <div class="pwc-tile--price-secondary">10,26&euro;/kg</div>
      <div class="pwc-tile--price-sdr"></div>
    </div>
  </div>
</div>
<div class="search-view-more-products-btn-wrapper infinite-scroll-placeholder"
  data-url="https://www.continente.pt/on/demandware.store/Sites-continente-Site/default/Search-UpdateGrid?cgid=mercearias&amp;pmin=0%2e01&amp;srule=Continente&amp;start=35&amp;sz=35">
</div>
`;

async function collect(adapter: ContinenteAdapter): Promise<RawProduct[]> {
  const out: RawProduct[] = [];
  for await (const p of adapter.fetchCategory("mercearias")) out.push(p);
  return out;
}

describe("ContinenteAdapter", () => {
  it("descobre os cgid reais usados pelo endpoint atual", async () => {
    const adapter = new ContinenteAdapter({ dryRun: true });
    await expect(adapter.discoverCategories()).resolves.toEqual([
      "mercearias",
      "laticinios",
      "bebidas",
      "limpeza",
    ]);
  });

  it("extrai produtos do HTML Search-UpdateGrid", () => {
    const items = parseContinenteGridHtml(GRID_HTML);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "5253941",
      productName: "Massa Esparguete Pack Poupança Continente",
      brand: "Continente",
      salePrice: 0.99,
      pricePerUnit: "0,99€/kg",
      category: "Mercearia/Arroz, Massa e Farinha/Massa",
      quantityText: "emb. 1 kg",
    });
    expect(items[0].imageUrl).toContain("5253941-frente.jpg?sw=87&sh=80");
    expect(items[1]).toMatchObject({
      id: "7314143",
      productName: "Atum ao Natural Tritão",
      brand: "Tritão",
      listPrice: "0,87€",
      salePrice: 0.79,
      pricePerUnit: "10,26€/kg",
    });
  });

  it("normaliza produtos reais do Continente para RawProduct", async () => {
    const http = {
      getText: async () => GRID_HTML,
    } as unknown as HttpClient;
    const products = await collect(new ContinenteAdapter({ dryRun: false, http }));

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      marketSku: "5253941",
      name: "Massa Esparguete Pack Poupança Continente 1 kg",
      brand: "Continente",
      priceRegular: 0.99,
      pricePromo: null,
      hasPromo: false,
      pricePerUnit: 0.99,
      pricePerUnitUom: "kg",
      categoryPath: "Mercearia/Arroz, Massa e Farinha/Massa",
    });
    expect(products[0].productUrl).toBe(
      "https://www.continente.pt/produto/massa-esparguete-pack-poupanca-continente-continente-5253941.html",
    );
    expect(products[1]).toMatchObject({
      marketSku: "7314143",
      name: "Atum ao Natural Tritão 110 gr (peso escorrido 77 gr)",
      priceRegular: 0.87,
      pricePromo: 0.79,
      hasPromo: true,
      pricePerUnit: 10.26,
      pricePerUnitUom: "kg",
    });
  });

  it("descobre categorias-folha de mercearia a partir do sitemap", async () => {
    const xml = `
      <urlset>
        <loc>https://www.continente.pt/mercearia/</loc>
        <loc>https://www.continente.pt/mercearia/arroz/</loc>
        <loc>https://www.continente.pt/oportunidades/livros/</loc>
      </urlset>
    `;
    const http = { getText: async () => xml } as unknown as HttpClient;
    const adapter = new ContinenteAdapter({ dryRun: false, http });
    await expect(adapter.discoverCategories()).resolves.toEqual(["/mercearia/arroz/"]);
  });
});
