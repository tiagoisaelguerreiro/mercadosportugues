import type { BaseUnit, RawProduct } from "@/lib/types";
import { computePricePerUnit, parsePrice, parseQuantity } from "@/lib/parsing";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";

/**
 * Adapter do Continente (plataforma Salesforce Commerce Cloud).
 *
 * ESTRATEGIA
 * ----------
 * O site expõe a grelha de produtos por categoria via endpoints internos do
 * tipo `Search-UpdateGrid`, que aceitam paginacao por `start`/`sz` e o id de
 * categoria `cgid`. Estes respondem HTML, mas o markup inclui atributos
 * `data-*` com o JSON do produto (preco, gtin/ean, imagem). Em alternativa,
 * paginas de produto individual expõem JSON-LD (`<script type=application/ld+json>`).
 *
 * PASSO ZERO (obrigatorio antes de usar em producao):
 *   1. Abrir https://www.continente.pt numa categoria.
 *   2. DevTools -> Network -> filtrar Fetch/XHR.
 *   3. Confirmar o endpoint real, os nomes dos parametros e o formato da
 *      resposta (podem mudar). Ajustar GRID_URL e parseGridResponse abaixo.
 *
 * Como o formato exato e volatil e nao deve ser assumido as cegas, este
 * adapter inclui um modo `dry-run`/fixture que produz dados de exemplo, e o
 * ponto de integracao real esta claramente isolado em `fetchPage`.
 */
export class ContinenteAdapter extends BaseAdapter {
  readonly slug = "continente";
  readonly supermarketId = 1;

  private readonly base = "https://www.continente.pt";
  private readonly gridUrl =
    "https://www.continente.pt/on/demandware.store/Sites-continente-Site/pt_PT/Search-UpdateGrid";
  private readonly pageSize = 36;
  private readonly http: HttpClient;
  private readonly dryRun: boolean;

  constructor(opts: { dryRun?: boolean; http?: HttpClient } = {}) {
    super();
    // Dry-run e o default seguro: so faz pedidos reais com SCRAPER_DRY_RUN=false.
    this.dryRun = opts.dryRun ?? process.env.SCRAPER_DRY_RUN !== "false";
    this.http = opts.http ?? new HttpClient();
  }

  async discoverCategories(): Promise<string[]> {
    // Em producao, raspar o menu de navegacao. Lista curada para arranque:
    return ["mercearia", "laticinios-ovos", "bebidas", "limpeza"];
  }

  async *fetchCategory(category: string): AsyncIterable<RawProduct> {
    let start = 0;
    for (;;) {
      const items = await this.fetchPage(category, start);
      if (items.length === 0) break;
      for (const item of items) {
        const raw = this.toRawProduct(item);
        if (raw) yield raw;
      }
      if (items.length < this.pageSize) break;
      start += this.pageSize;
    }
  }

  /**
   * Obtem uma pagina de produtos. Ponto unico de integracao com o site real.
   * Em dry-run devolve uma fixture deterministica.
   */
  private async fetchPage(category: string, start: number): Promise<ContinenteRawItem[]> {
    if (this.dryRun) {
      return this.fixturePage(category, start);
    }
    // Integracao real (a confirmar/ajustar no passo zero):
    //   const html = await this.http.getText(this.gridUrl, { cgid: category, start, sz: this.pageSize });
    //   return parseGridHtml(html);
    const data = await this.http.getJson<{ products?: ContinenteRawItem[] }>(this.gridUrl, {
      cgid: category,
      start,
      sz: this.pageSize,
    });
    return data.products ?? [];
  }

  /** Converte o item bruto do Continente no formato canonico. */
  private toRawProduct(item: ContinenteRawItem): RawProduct | null {
    const name = item.productName?.trim();
    if (!name) return null;

    const listPrice = parsePrice(item.price?.list?.value ?? item.listPrice);
    const salePrice = parsePrice(item.price?.sales?.value ?? item.salePrice);
    const regular = listPrice ?? salePrice;
    if (regular == null) return null;

    const hasPromo = salePrice != null && listPrice != null && salePrice < listPrice;
    const effective = hasPromo ? salePrice! : regular;

    const quantity = parseQuantity(name);
    let ppuValue = parsePrice(item.pricePerUnit);
    let ppuUom = normalizeUom(item.pricePerUnitUom);
    if (ppuValue == null) {
      const computed = computePricePerUnit(effective, quantity);
      if (computed) {
        ppuValue = computed.value;
        ppuUom = computed.uom;
      }
    }

    return {
      marketSku: String(item.id ?? item.productID ?? item.gtin ?? name),
      name,
      brand: item.brand?.trim() || null,
      ean: cleanEan(item.gtin ?? item.ean),
      priceRegular: regular,
      pricePromo: hasPromo ? salePrice! : null,
      hasPromo,
      pricePerUnit: ppuValue,
      pricePerUnitUom: ppuUom,
      imageUrl: item.image?.url ?? item.imageUrl ?? null,
      productUrl: item.url ? absolute(this.base, item.url) : null,
      categoryPath: item.category ?? null,
    };
  }

  // ── Fixture deterministica para dry-run / desenvolvimento ──────────────────
  private fixturePage(category: string, start: number): ContinenteRawItem[] {
    if (start > 0) return []; // uma so pagina na fixture
    const samples: Record<string, ContinenteRawItem[]> = {
      "laticinios-ovos": [
        {
          id: "cnt-leite-mimosa-1l",
          productName: "Leite UHT Meio Gordo Mimosa 1L",
          brand: "Mimosa",
          gtin: "5601010000017",
          listPrice: "0,95",
          salePrice: "0,89",
          imageUrl: "https://placehold.co/300x300/png?text=Leite+Mimosa",
          url: "/produto/leite-uht-mimosa",
          category: "Laticínios e Ovos",
        },
        {
          id: "cnt-ovos-m-6un",
          productName: "Ovos Classe M 6 un",
          brand: "Continente",
          gtin: "5601010000079",
          listPrice: "1,39",
          imageUrl: "https://placehold.co/300x300/png?text=Ovos",
          url: "/produto/ovos-classe-m",
          category: "Laticínios e Ovos",
        },
      ],
      mercearia: [
        {
          id: "cnt-arroz-cigala-1kg",
          productName: "Arroz Agulha Cigala 1kg",
          brand: "Cigala",
          gtin: "5601010000024",
          listPrice: "1,49",
          imageUrl: "https://placehold.co/300x300/png?text=Arroz+Cigala",
          url: "/produto/arroz-agulha-cigala",
          category: "Mercearia",
        },
      ],
      bebidas: [
        {
          id: "cnt-coca-cola-1.5l",
          productName: "Coca-Cola Original 1.5L",
          brand: "Coca-Cola",
          gtin: "5449000000996",
          listPrice: "1,99",
          salePrice: "1,79",
          imageUrl: "https://placehold.co/300x300/png?text=Coca-Cola",
          url: "/produto/coca-cola-1-5l",
          category: "Bebidas",
        },
      ],
      limpeza: [
        {
          id: "cnt-skip-1.5l",
          productName: "Detergente Roupa Líquido Skip 1.5L",
          brand: "Skip",
          gtin: "5601010000086",
          listPrice: "7,99",
          salePrice: "6,49",
          imageUrl: "https://placehold.co/300x300/png?text=Skip",
          url: "/produto/detergente-skip",
          category: "Limpeza",
        },
      ],
    };
    return samples[category] ?? [];
  }
}

// Forma (parcial e tolerante) do item devolvido pelo Continente.
interface ContinenteRawItem {
  id?: string;
  productID?: string;
  productName?: string;
  brand?: string;
  gtin?: string;
  ean?: string;
  listPrice?: string | number;
  salePrice?: string | number;
  price?: {
    list?: { value?: number };
    sales?: { value?: number };
  };
  pricePerUnit?: string | number;
  pricePerUnitUom?: string;
  image?: { url?: string };
  imageUrl?: string;
  url?: string;
  category?: string;
}

function cleanEan(ean: string | undefined | null): string | null {
  if (!ean) return null;
  const digits = ean.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function normalizeUom(uom: string | undefined | null): BaseUnit | null {
  if (!uom) return null;
  const u = uom.toLowerCase();
  if (u.includes("kg")) return "kg";
  if (u === "l" || u.includes("lt") || u.includes("litro")) return "L";
  return null;
}

function absolute(base: string, url: string): string {
  if (url.startsWith("http")) return url;
  return base + (url.startsWith("/") ? url : `/${url}`);
}
