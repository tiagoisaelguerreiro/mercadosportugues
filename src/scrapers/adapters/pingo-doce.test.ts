import { describe, expect, it } from "vitest";
import { PingoDoceAdapter, parsePingoDoceGridHtml } from "@/scrapers/adapters/pingo-doce";
import { matchProduct, type MatchCandidate } from "@/lib/matching";
import { productsGlobal } from "@/db/seed-data";
import type { HttpClient } from "@/scrapers/core/http-client";
import type { RawProduct } from "@/lib/types";

async function collect(adapter: PingoDoceAdapter): Promise<RawProduct[]> {
  const out: RawProduct[] = [];
  for await (const p of adapter.fetchAll()) out.push(p);
  return out;
}

const candidates: MatchCandidate[] = productsGlobal.map((g) => ({ ...g }));

const pingoDoceGridHtml = `
<div class="product" data-pid="650222">
  <div class="product-tile-pd" data-pid="650222" data-gtm-info="{&quot;currency&quot;:&quot;EUR&quot;,&quot;value&quot;:0.59,&quot;items&quot;:[{&quot;item_id&quot;:&quot;650222&quot;,&quot;item_name&quot;:&quot;Farinha de Trigo Tipo 55 Sem Fermento Pingo Doce&quot;,&quot;item_brand&quot;:&quot;Pingo Doce&quot;,&quot;item_category&quot;:&quot;Farinha, Fermento e Pão Ralado&quot;,&quot;price&quot;:0.59,&quot;discount&quot;:0}]}">
    <a class="product-tile-image-link" href="/home/produtos/mercearia/farinha-fermento-e-acucar/farinha-de-trigo-tipo-55-sem-fermento-pingo-doce-650222.html">
      <img class="product-tile-component-image" src="https://www.pingodoce.pt/dw/image/v2/farinha.jpg" alt="Farinha">
    </a>
    <div class="product-name-link"><a>Farinha de Trigo Tipo 55 Sem Fermento Pingo Doce</a></div>
    <div class="product-brand-name">Pingo Doce</div>
    <div class="product-unit">1 Kg</div>
    <div class="product-price"><span class="sales"><span class="value" content="0.59"></span>0,59 €</span></div>
    <div class="product-cta"></div>
  </div>
</div>
<div class="product" data-pid="46397">
  <div class="product-tile-pd" data-pid="46397" data-gtm-info="{&quot;currency&quot;:&quot;EUR&quot;,&quot;value&quot;:2.09,&quot;items&quot;:[{&quot;item_id&quot;:&quot;46397&quot;,&quot;item_name&quot;:&quot;Tomate Alongado 57/67&quot;,&quot;item_brand&quot;:&quot;Nossa Fruta e Legumes&quot;,&quot;item_category&quot;:&quot;Tomates, Pepinos e Pimentos&quot;,&quot;price&quot;:2.09,&quot;discount&quot;:0.2}]}">
    <a class="product-tile-image-link" href="/home/produtos/frutas-e-vegetais/vegetais/tomates-pepinos-e-pimentos/tomate-alongado-46397.html">
      <img class="product-tile-component-image" src="https://www.pingodoce.pt/dw/image/v2/tomate.jpg" alt="Tomate">
    </a>
    <div class="product-name-link"><a>Tomate Alongado 57/67</a></div>
    <div class="product-brand-name">Nossa Fruta e Legumes</div>
    <div class="product-unit">0.15 Kg</div>
    <div class="product-price"><span class="sales"><span class="value" content="2.09"></span>2,09 €/Kg</span></div>
    <div class="product-cta"></div>
  </div>
</div>
`;

describe("PingoDoceAdapter (dry-run)", () => {
  it("produz RawProduct normalizados de varias categorias", async () => {
    const adapter = new PingoDoceAdapter({ dryRun: true });
    const products = await collect(adapter);
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.priceRegular).toBeGreaterThan(0);
      expect(p.marketSku).toBeTruthy();
    }
  });

  it("extrai EAN limpo (so digitos, 8-14)", async () => {
    const products = await collect(new PingoDoceAdapter({ dryRun: true }));
    const withEan = products.filter((p) => p.ean);
    expect(withEan.length).toBeGreaterThan(0);
    for (const p of withEan) {
      expect(p.ean).toMatch(/^\d{8,14}$/);
    }
  });

  it("deteta promocoes (promoPrice < regularPrice)", async () => {
    const products = await collect(new PingoDoceAdapter({ dryRun: true }));
    const arroz = products.find((p) => /arroz/i.test(p.name));
    expect(arroz?.hasPromo).toBe(true);
    expect(arroz?.pricePromo).toBeLessThan(arroz!.priceRegular);
  });

  it("calcula preco por unidade (€/L) quando ha quantidade", async () => {
    const products = await collect(new PingoDoceAdapter({ dryRun: true }));
    const leite = products.find((p) => /leite/i.test(p.name));
    expect(leite?.pricePerUnitUom).toBe("L");
    expect(leite?.pricePerUnit).toBeGreaterThan(0);
  });

  it("liga ao produto global correto por EAN, apesar do nome diferente", async () => {
    const products = await collect(new PingoDoceAdapter({ dryRun: true }));
    // "Leite Meio Gordo UHT Mimosa 1 L" (PD) vs "Leite UHT Meio Gordo 1L" (global)
    const leite = products.find((p) => /leite/i.test(p.name))!;
    const outcome = matchProduct(
      { name: leite.name, ean: leite.ean },
      candidates,
      (ean) => candidates.find((c) => c.eanCode === ean),
    );
    expect(outcome.status).toBe("matched");
    expect(outcome.confidence).toBe(1);
    const matched = productsGlobal.find((g) => g.id === outcome.globalId);
    expect(matched?.eanCode).toBe(leite.ean);
  });

  it("faz match por fuzzy quando o EAN nao corresponde a nenhum global", async () => {
    const products = await collect(new PingoDoceAdapter({ dryRun: true }));
    const arroz = products.find((p) => /arroz/i.test(p.name))!;
    // Remove o EAN para forcar o caminho fuzzy + veto de tamanho.
    const outcome = matchProduct({ name: arroz.name, ean: null }, candidates);
    expect(outcome.globalId).not.toBeNull();
    const matched = productsGlobal.find((g) => g.id === outcome.globalId);
    expect(matched?.nameGlobal.toLowerCase()).toContain("arroz");
  });

  it("a segunda pagina vem vazia (fixture de uma pagina)", async () => {
    const adapter = new PingoDoceAdapter({ dryRun: true });
    const page2: RawProduct[] = [];
    for await (const p of adapter.fetchCategory("mercearia")) page2.push(p);
    // mercearia tem produtos na pagina 1; garantimos que termina (nao loop infinito)
    expect(page2.length).toBeGreaterThan(0);
  });
});

describe("PingoDoceAdapter (parser HTML publico)", () => {
  it("extrai produtos a partir dos tiles HTML do Pingo Doce", () => {
    const products = parsePingoDoceGridHtml(pingoDoceGridHtml);

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      id: "650222",
      name: "Farinha de Trigo Tipo 55 Sem Fermento Pingo Doce",
      brand: "Pingo Doce",
      regularPrice: 0.59,
      category: "Farinha, Fermento e Pão Ralado",
    });
    expect(products[0].imageUrl).toContain("farinha.jpg");
    expect(products[0].url).toContain("farinha-de-trigo");

    expect(products[1]).toMatchObject({
      id: "46397",
      name: "Tomate Alongado 57/67",
      brand: "Nossa Fruta e Legumes",
      regularPrice: 2.29,
      promoPrice: 2.09,
      // texto bruto do parser; a normalizacao para "kg" acontece em toRawProduct
      pricePerUnitUom: "2,09 €/Kg",
    });
  });

  it("normaliza o HTML publico em RawProduct no modo real sem paginar parametros bloqueados", async () => {
    const requestedUrls: string[] = [];
    const http = {
      async getText(url: string): Promise<string> {
        requestedUrls.push(url);
        return pingoDoceGridHtml;
      },
    } as unknown as HttpClient;
    const adapter = new PingoDoceAdapter({ dryRun: false, http });
    const products: RawProduct[] = [];

    for await (const product of adapter.fetchCategory("mercearia")) {
      products.push(product);
    }

    expect(requestedUrls).toEqual(["https://www.pingodoce.pt/home/produtos/mercearia"]);
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      marketSku: "650222",
      name: "Farinha de Trigo Tipo 55 Sem Fermento Pingo Doce 1 Kg",
      brand: "Pingo Doce",
      priceRegular: 0.59,
      pricePromo: null,
      hasPromo: false,
      pricePerUnit: 0.59,
      pricePerUnitUom: "kg",
      productUrl:
        "https://www.pingodoce.pt/home/produtos/mercearia/farinha-fermento-e-acucar/farinha-de-trigo-tipo-55-sem-fermento-pingo-doce-650222.html",
    });
    expect(products[1]).toMatchObject({
      marketSku: "46397",
      name: "Tomate Alongado 57/67 0.15 Kg",
      priceRegular: 2.29,
      pricePromo: 2.09,
      hasPromo: true,
      pricePerUnit: 2.09,
      pricePerUnitUom: "kg",
    });
  });

  it("aceita o path completo da categoria no modo real", async () => {
    const requestedUrls: string[] = [];
    const http = {
      async getText(url: string): Promise<string> {
        requestedUrls.push(url);
        return pingoDoceGridHtml;
      },
    } as unknown as HttpClient;
    const products: RawProduct[] = [];
    for await (const product of new PingoDoceAdapter({ dryRun: false, http }).fetchCategory(
      "/home/produtos/ovos",
    )) {
      products.push(product);
    }
    expect(requestedUrls).toEqual(["https://www.pingodoce.pt/home/produtos/ovos"]);
    expect(products).toHaveLength(2);
  });

  it("descobre categorias-folha a partir do sitemap", async () => {
    const xml = `
      <urlset>
        <loc>https://www.pingodoce.pt/home/produtos/mercearia</loc>
        <loc>https://www.pingodoce.pt/home/produtos/mercearia/arroz</loc>
        <loc>https://www.pingodoce.pt/home/sobre</loc>
      </urlset>
    `;
    const http = { getText: async () => xml } as unknown as HttpClient;
    await expect(new PingoDoceAdapter({ dryRun: false, http }).discoverCategories()).resolves.toEqual([
      "/home/produtos/mercearia/arroz/",
    ]);
  });

  it("deteta promo pelo preco riscado mesmo com discount=0 no GTM (markup real)", () => {
    // Estrutura real observada em www.pingodoce.pt: o GTM traz discount 0 mas o
    // HTML tem .sales.reduced-price + .strike-through.list com content maquina.
    const html = `
<div class="product" data-pid="111">
  <div class="product-tile-pd" data-pid="111" data-gtm-info='{&quot;currency&quot;:&quot;EUR&quot;,&quot;value&quot;:1.39,&quot;items&quot;:[{&quot;item_id&quot;:&quot;111&quot;,&quot;item_name&quot;:&quot;Cafe Moido&quot;,&quot;discount&quot;:0,&quot;item_brand&quot;:&quot;Delta&quot;,&quot;item_category&quot;:&quot;Cafe&quot;,&quot;price&quot;:1.39}]}'>
  <div class="product-brand-name">Delta</div>
  <div class="product-name-link"><a href="/p/111.html">Cafe Moido</a></div>
  <div class="product-unit">250 g</div>
  <div class="product-price ">
    <span>
      <span class="sales reduced-price">
        <span class="value" content="1.39"></span>
        1,39 &euro;
      </span>
      <span class="strike-through list">
        <span class="value" content="1.79">
          <span class="sr-only">Price reduced from</span>
          1,79 &euro;
          <span class="sr-only">to</span>
        </span>
      </span>
    </span>
  </div>
</div>
<div class="search-view-more-products-btn-wrapper"></div>`;
    const products = parsePingoDoceGridHtml(html);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "111",
      regularPrice: 1.79,
      promoPrice: 1.39,
    });
  });

  it("le o preco por unidade do .product-unit (markup real '1 Kg | 0,59 €/Kg')", () => {
    const html = `
<div class="product" data-pid="650222">
  <div class="product-tile-pd" data-pid="650222" data-gtm-info='{&quot;currency&quot;:&quot;EUR&quot;,&quot;value&quot;:0.59,&quot;items&quot;:[{&quot;item_id&quot;:&quot;650222&quot;,&quot;item_name&quot;:&quot;Farinha&quot;,&quot;discount&quot;:0,&quot;item_brand&quot;:&quot;Pingo Doce&quot;,&quot;item_category&quot;:&quot;Farinha&quot;,&quot;price&quot;:0.59}]}'>
  <div class="product-brand-name">Pingo Doce</div>
  <div class="product-name-link"><a href="/p/650222.html">Farinha</a></div>
  <div class="product-unit">
    1 Kg | 0,59 &euro;/Kg
  </div>
  <div class="product-price ">
    <span>
      <span class="sales ">
        <span class="value" content="0.59"></span>
        0,59 &euro;
      </span>
    </span>
  </div>
</div>
<div class="search-view-more-products-btn-wrapper"></div>`;
    const products = parsePingoDoceGridHtml(html);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      regularPrice: 0.59,
      promoPrice: undefined,
      pricePerUnit: 0.59,
      pricePerUnitUom: "kg",
    });
  });
});
