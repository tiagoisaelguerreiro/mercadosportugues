import type { BaseUnit, RawProduct } from "@/lib/types";
import { computePricePerUnit, parsePrice, parseQuantity } from "@/lib/parsing";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";
import { upgradeImageUrl } from "../core/html";
import { discoverLeafCategoryPaths, limitCategories } from "../core/sitemap";

const CATEGORY_SITEMAP = "https://www.continente.pt/sitemap-custom_sitemap_23-category.xml";

/** Departamentos de mercearia/casa — exclui campanhas, livros, etc. */
const GROCERY_PREFIXES = [
  "/mercearia/",
  "/laticinios-e-ovos/",
  "/bebidas-e-garrafeira/",
  "/garrafeira/",
  "/frescos/",
  "/congelados/",
  "/limpeza/",
  "/beleza-e-higiene/",
  "/higiene-e-beleza/",
  "/bio-e-saudavel/",
  "/bebe/",
];

const FALLBACK_CATEGORIES = [
  "/mercearia/",
  "/mercearia/arroz-massa-e-farinha/",
  "/mercearia/azeite-oleo-e-vinagre/",
  "/mercearia/cafe-cha-e-chocolate-soluvel/",
  "/laticinios-e-ovos/",
  "/bebidas-e-garrafeira/",
  "/frescos/",
  "/higiene-e-beleza/",
];

/**
 * Adapter do Continente (plataforma Salesforce Commerce Cloud).
 *
 * ESTRATEGIA
 * ----------
 * O robots.txt bloqueia `?start=`/`?sz=` e a grelha ajax Demandware. Em modo
 * real lemos o sitemap publico de categorias, ficamos com as folhas de
 * mercearia e pedimos a primeira pagina HTML de cada uma (sem parametros).
 * Categorias-folha sao pequenas o suficiente para caber nessa primeira pagina.
 */
export class ContinenteAdapter extends BaseAdapter {
  readonly slug = "continente";
  readonly supermarketId = 1;

  private readonly base = "https://www.continente.pt";
  private readonly pageSize = 35;
  private readonly http: HttpClient;
  private readonly dryRun: boolean;

  constructor(opts: { dryRun?: boolean; http?: HttpClient } = {}) {
    super();
    // Dry-run e o default seguro: so faz pedidos reais com SCRAPER_DRY_RUN=false.
    this.dryRun = opts.dryRun ?? process.env.SCRAPER_DRY_RUN !== "false";
    this.http =
      opts.http ??
      new HttpClient({
        defaultHeaders: {
          Accept: "text/html,application/xhtml+xml,application/json,*/*",
          Referer: `${this.base}/`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
  }

  async discoverCategories(): Promise<string[]> {
    if (this.dryRun) return ["mercearias", "laticinios", "bebidas", "limpeza"];
    try {
      const xml = await this.http.getText(CATEGORY_SITEMAP);
      const paths = limitCategories(
        discoverLeafCategoryPaths(xml, { pathPrefixes: GROCERY_PREFIXES, skipQuery: true }),
      );
      if (paths.length > 0) return paths;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ continente: sitemap indisponivel (${message}); a usar lista fallback`);
    }
    return FALLBACK_CATEGORIES;
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
    if (start > 0) return [];
    const html = await this.http.getText(absolute(this.base, category));
    return parseContinenteGridHtml(html);
  }

  /** Converte o item bruto do Continente no formato canonico. */
  private toRawProduct(item: ContinenteRawItem): RawProduct | null {
    const productName = item.productName?.trim();
    const name = productName ? withQuantityLabel(productName, item.quantityText) : null;
    if (!name) return null;

    const listPrice = parsePrice(item.listPrice);
    const salePrice = parsePrice(item.salePrice);
    const regular = listPrice != null && salePrice != null && listPrice > salePrice ? listPrice : (salePrice ?? listPrice);
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
      imageUrl: upgradeImageUrl(item.image?.url ?? item.imageUrl ?? null),
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
          imageUrl: null,
          url: "/produto/leite-uht-mimosa",
          category: "Laticínios e Ovos",
        },
        {
          id: "cnt-ovos-m-6un",
          productName: "Ovos Classe M 6 un",
          brand: "Continente",
          gtin: "5601010000079",
          listPrice: "1,39",
          imageUrl: null,
          url: "/produto/ovos-classe-m",
          category: "Laticínios e Ovos",
        },
      ],
      laticinios: [
        {
          id: "cnt-leite-mimosa-1l",
          productName: "Leite UHT Meio Gordo Mimosa 1L",
          brand: "Mimosa",
          gtin: "5601010000017",
          listPrice: "0,95",
          salePrice: "0,89",
          imageUrl: null,
          url: "/produto/leite-uht-mimosa",
          category: "Laticínios e Ovos",
        },
        {
          id: "cnt-ovos-m-6un",
          productName: "Ovos Classe M 6 un",
          brand: "Continente",
          gtin: "5601010000079",
          listPrice: "1,39",
          imageUrl: null,
          url: "/produto/ovos-classe-m",
          category: "Laticínios e Ovos",
        },
      ],
      mercearias: [
        {
          id: "cnt-arroz-cigala-1kg",
          productName: "Arroz Agulha Cigala 1kg",
          brand: "Cigala",
          gtin: "5601010000024",
          listPrice: "1,49",
          imageUrl: null,
          url: "/produto/arroz-agulha-cigala",
          category: "Mercearia",
        },
      ],
      mercearia: [
        {
          id: "cnt-arroz-cigala-1kg",
          productName: "Arroz Agulha Cigala 1kg",
          brand: "Cigala",
          gtin: "5601010000024",
          listPrice: "1,49",
          imageUrl: null,
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
          imageUrl: null,
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
          imageUrl: null,
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
  imageUrl?: string | null;
  url?: string;
  category?: string;
  quantityText?: string;
}

interface ContinenteTileImpression {
  id?: string;
  name?: string;
  price?: number;
  brand?: string;
  category?: string;
}

interface ContinenteImageData {
  url?: string;
}

export function parseContinenteGridHtml(html: string): ContinenteRawItem[] {
  const items: ContinenteRawItem[] = [];
  for (const block of splitProductBlocks(html)) {
    const item = parseProductBlock(block);
    if (item) items.push(item);
  }
  return items;
}

function splitProductBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re =
    /<div class="product"\s+data-pid="[^"]+">[\s\S]*?(?=<div class="product"\s+data-pid="|<div class="search-view-more-products-btn-wrapper|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function parseProductBlock(block: string): ContinenteRawItem | null {
  const impression = parseHtmlJsonAttribute<ContinenteTileImpression>(
    extractAttribute(block, "data-product-tile-impression"),
  );
  const pid = extractProductId(block) ?? impression?.id;
  const salePrice = impression?.price ?? parsePrice(extractPriceText(block, "pwc-tile--price-primary"));
  const productNameText =
    impression?.name ?? cleanHtmlText(extractClassBody(block, "pwc-tile--description"));

  if (!pid || !productNameText || salePrice == null) return null;

  const image = parseHtmlJsonAttribute<ContinenteImageData>(
    extractAttribute(block, "data-confirmation-image"),
  );
  const pricePerUnitText = extractPriceText(block, "pwc-tile--price-secondary");
  const listPriceText = extractStrikeThroughPrice(block);

  return {
    id: pid,
    productName: decodeHtmlEntities(productNameText),
    brand: decodeHtmlEntities(impression?.brand ?? ""),
    listPrice: listPriceText ?? undefined,
    salePrice,
    pricePerUnit: pricePerUnitText ?? undefined,
    pricePerUnitUom: pricePerUnitText ?? undefined,
    imageUrl: image?.url ?? extractImageUrl(block) ?? undefined,
    url: extractProductUrl(block) ?? undefined,
    category: decodeHtmlEntities(impression?.category ?? ""),
    quantityText: cleanHtmlText(extractClassBody(block, "pwc-tile--quantity")) ?? undefined,
  };
}

function parseHtmlJsonAttribute<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeHtmlEntities(value)) as T;
  } catch {
    return null;
  }
}

function extractProductId(block: string): string | null {
  return block.match(/<div class="product"\s+data-pid="([^"]+)"/)?.[1] ?? null;
}

function extractAttribute(html: string, attr: string): string | null {
  const re = new RegExp(`${attr}=(["'])([\\s\\S]*?)\\1`, "i");
  return html.match(re)?.[2] ?? null;
}

function extractClassBody(html: string, className: string): string | null {
  const re = new RegExp(
    `<[^>]*class=(["'])[^"']*${className}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i",
  );
  return html.match(re)?.[2] ?? null;
}

function extractPriceText(block: string, className: string): string | null {
  const classStart = block.search(new RegExp(className, "i"));
  if (classStart < 0) return null;

  const tagStart = Math.max(0, block.lastIndexOf("<", classStart));
  const afterStart = block.slice(tagStart);
  const nextRe =
    className === "pwc-tile--price-primary"
      ? /<[^>]*class=(["'])[^"']*pwc-tile--price-secondary[^"']*\1/i
      : /<[^>]*class=(["'])[^"']*(?:pwc-tile--price-sdr|pwc-tile-buy-section)[^"']*\1/i;
  const nextPrice = afterStart.search(nextRe);
  const segment = nextPrice > 0 ? afterStart.slice(0, nextPrice) : afterStart.slice(0, 500);
  return cleanHtmlText(segment);
}

function extractStrikeThroughPrice(block: string): string | null {
  const match = block.match(
    /<span class="strike-through[^"]*pwc-tile--price-dashed"[\s\S]*?<span class="value[^"]*pwc-tile--price-value[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  return cleanHtmlText(match?.[1] ?? null);
}

function extractProductUrl(block: string): string | null {
  const match = block.match(/<a[^>]+href=(["'])(https?:\/\/www\.continente\.pt\/produto\/[^"']+)\1/i);
  return match ? decodeHtmlEntities(match[2]) : null;
}

function extractImageUrl(block: string): string | null {
  const match = block.match(/\sdata-src=(["'])(https?:\/\/www\.continente\.pt\/dw\/image\/[^"']+)\1/i);
  return match ? decodeHtmlEntities(match[2]) : null;
}

function cleanHtmlText(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = decodeHtmlEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function withQuantityLabel(name: string, quantityText: string | undefined): string {
  if (!quantityText || parseQuantity(name)) return name;
  const cleanQuantity = quantityText
    .replace(/^emb\.\s*/i, "")
    .replace(/^quant\.\s*m[ií]nima\s*=\s*/i, "")
    .trim();
  return cleanQuantity ? `${name} ${cleanQuantity}` : name;
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    quot: "\"",
    amp: "&",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    euro: "€",
    aacute: "á",
    agrave: "à",
    acirc: "â",
    atilde: "ã",
    ccedil: "ç",
    eacute: "é",
    ecirc: "ê",
    iacute: "í",
    oacute: "ó",
    ocirc: "ô",
    otilde: "õ",
    uacute: "ú",
    Aacute: "Á",
    Agrave: "À",
    Acirc: "Â",
    Atilde: "Ã",
    Ccedil: "Ç",
    Eacute: "É",
    Ecirc: "Ê",
    Iacute: "Í",
    Oacute: "Ó",
    Ocirc: "Ô",
    Otilde: "Õ",
    Uacute: "Ú",
  };

  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#x")) return String.fromCharCode(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCharCode(parseInt(key.slice(1), 10));
    return named[key] ?? entity;
  });
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
