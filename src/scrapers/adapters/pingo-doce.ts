import type { BaseUnit, RawProduct } from "@/lib/types";
import { computePricePerUnit, parsePrice, parseQuantity, round } from "@/lib/parsing";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";
import { upgradeImageUrl, extractMicrodataPrice, parseUnitPriceLabel } from "../core/html";
import { discoverLeafCategoryPaths, limitCategories } from "../core/sitemap";

const PUBLIC_CATEGORY_PATHS: Record<string, string> = {
  mercearia: "/home/produtos/mercearia",
  "leite-e-bebidas-vegetais": "/home/produtos/leite-e-bebidas-vegetais",
  ovos: "/home/produtos/ovos",
  "iogurtes-e-sobremesas": "/home/produtos/iogurtes-e-sobremesas",
  "manteiga-margarina-e-natas": "/home/produtos/manteiga-margarina-e-natas",
  "aguas-sumos-e-refrigerantes": "/home/produtos/aguas-sumos-e-refrigerantes",
  "cervejas-e-sidras": "/home/produtos/cervejas-e-sidras",
  "frutas-e-vegetais": "/home/produtos/frutas-e-vegetais",
  "padaria-e-pastelaria": "/home/produtos/padaria-e-pastelaria",
  "cafe-cha-e-achocolatados": "/home/produtos/cafe-cha-e-achocolatados",
  "bolachas-cereais-e-guloseimas": "/home/produtos/bolachas-cereais-e-guloseimas",
  limpeza: "/home/produtos/limpeza",
};

const DRY_RUN_CATEGORIES = ["mercearia", "laticinios-ovos", "bebidas", "limpeza"];

const CATEGORY_SITEMAP = "https://www.pingodoce.pt/home/sitemap_2.xml";
const PRODUCT_PREFIXES = ["/home/produtos/"];

/**
 * Adapter do Pingo Doce (plataforma Salesforce Commerce Cloud).
 *
 * ESTRATEGIA (confirmada em producao)
 * ----------
 * O catalogo esta em pingodoce.pt. Lemos o sitemap publico, ficamos com as
 * categorias-folha em `/home/produtos/` e pedimos a primeira pagina HTML de
 * cada uma, sem parametros (o robots.txt bloqueia `/on/demandware.store/`,
 * pesquisa ajax e `?start=`/`?sz=`/`?cgid=` — respeitamos tudo).
 *
 * Por tile extraimos (por ordem de fiabilidade):
 *   - preco de venda e preco riscado dos microdata `.sales .value[content]` e
 *     `.strike-through .value[content]` (ex.: content="1.79"); o desconto GTM
 *     (`data-gtm-info`) vem a 0 mesmo havendo preco riscado, por isso serve
 *     apenas de fallback;
 *   - preco por unidade do `.product-unit` (ex.: "1 Kg | 0,59 €/Kg");
 *   - nome, marca, categoria e imagem (`static.pingodoce.pt`) do tile/GTM.
 *
 * Sem EAN na grelha — o matching faz-se por nome + veto de tamanho.
 */
export class PingoDoceAdapter extends BaseAdapter {
  readonly slug = "pingo-doce";
  readonly supermarketId = 2;

  private readonly base = "https://www.pingodoce.pt";
  private readonly pageSize = 50;
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
        },
      });
  }

  async discoverCategories(): Promise<string[]> {
    if (this.dryRun) return DRY_RUN_CATEGORIES;
    try {
      const xml = await this.http.getText(CATEGORY_SITEMAP);
      const paths = limitCategories(
        discoverLeafCategoryPaths(xml, { pathPrefixes: PRODUCT_PREFIXES, skipQuery: true }),
      );
      if (paths.length > 0) return paths;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ pingo-doce: sitemap indisponivel (${message}); a usar lista fallback`);
    }
    return Object.values(PUBLIC_CATEGORY_PATHS);
  }

  async *fetchCategory(category: string): AsyncIterable<RawProduct> {
    let page = 1;
    for (;;) {
      const items = await this.fetchPage(category, page);
      if (items.length === 0) break;
      for (const item of items) {
        const raw = this.toRawProduct(item);
        if (raw) yield raw;
      }
      if (items.length < this.pageSize) break;
      page += 1;
    }
  }

  /**
   * Obtem uma pagina de produtos. Ponto unico de integracao com o site real.
   * Em dry-run devolve uma fixture deterministica.
   */
  private async fetchPage(category: string, page: number): Promise<PingoDoceRawItem[]> {
    if (this.dryRun) {
      return this.fixturePage(category, page);
    }

    // O robots.txt bloqueia paginacao por `start`/`sz`; no modo real so usamos
    // a primeira pagina HTML publica da categoria.
    if (page > 1) return [];

    const categoryPath = category.startsWith("/") ? category : PUBLIC_CATEGORY_PATHS[category];
    if (!categoryPath) return [];

    const html = await this.http.getText(absolute(this.base, categoryPath));
    return parsePingoDoceGridHtml(html);
  }

  /** Converte o item bruto do Pingo Doce no formato canonico. */
  private toRawProduct(item: PingoDoceRawItem): RawProduct | null {
    const productName = (item.name ?? item.title)?.trim();
    const name = productName ? withQuantityLabel(productName, item.quantityText) : null;
    if (!name) return null;

    const priceObj = typeof item.price === "object" && item.price !== null ? item.price : null;
    const priceScalar = typeof item.price === "object" ? undefined : item.price;
    const regularRaw = parsePrice(item.regularPrice ?? priceObj?.value ?? priceScalar);
    const promoRaw = parsePrice(item.promoPrice ?? priceObj?.promotion?.value ?? item.salePrice);
    const regular = regularRaw ?? promoRaw;
    if (regular == null) return null;

    const hasPromo = promoRaw != null && regularRaw != null && promoRaw < regularRaw;
    const effective = hasPromo ? promoRaw! : regular;

    const quantity = parseQuantity(name);
    let ppuValue = parsePrice(item.unitPrice ?? item.pricePerUnit);
    let ppuUom = normalizeUom(item.unitPriceUom ?? item.pricePerUnitUom);
    if (ppuValue == null) {
      const computed = computePricePerUnit(effective, quantity);
      if (computed) {
        ppuValue = computed.value;
        ppuUom = computed.uom;
      }
    }

    const productUrl = item.url ?? (item.slug ? `/produto/${item.slug}` : null);

    return {
      marketSku: String(item.id ?? item.sku ?? item.ean ?? name),
      name,
      brand: item.brand?.trim() || null,
      ean: cleanEan(item.ean ?? item.gtin ?? item.barcode),
      priceRegular: regular,
      pricePromo: hasPromo ? promoRaw! : null,
      hasPromo,
      pricePerUnit: ppuValue,
      pricePerUnitUom: ppuUom,
      imageUrl: upgradeImageUrl(item.imageUrl ?? item.image?.url ?? null),
      productUrl: productUrl ? absolute(this.base, productUrl) : null,
      categoryPath: item.category ?? null,
    };
  }

  // ── Fixture deterministica para dry-run / desenvolvimento ──────────────────
  private fixturePage(category: string, page: number): PingoDoceRawItem[] {
    if (page > 1) return []; // uma so pagina na fixture
    const samples: Record<string, PingoDoceRawItem[]> = {
      "laticinios-ovos": [
        {
          id: "pd-leite-mimosa-1l",
          // Nome diferente do Continente, mesmo EAN -> exercita match por EAN.
          name: "Leite Meio Gordo UHT Mimosa 1 L",
          brand: "Mimosa",
          ean: "5601010000017",
          regularPrice: "0,92",
          imageUrl: null,
          slug: "leite-meio-gordo-mimosa",
          category: "Laticínios e Ovos",
        },
        {
          id: "pd-manteiga-mimosa-250g",
          name: "Manteiga com Sal Mimosa 250 g",
          brand: "Mimosa",
          ean: "5601010000055",
          regularPrice: "2,19",
          promoPrice: "1,99",
          imageUrl: null,
          slug: "manteiga-com-sal-mimosa",
          category: "Laticínios e Ovos",
        },
      ],
      mercearia: [
        {
          id: "pd-arroz-cigala-1kg",
          // Ordem de palavras diferente -> exercita o fuzzy (token-set).
          name: "Arroz Cigala Agulha 1 kg",
          brand: "Cigala",
          ean: "5601010000024",
          regularPrice: "1,45",
          promoPrice: "1,29",
          imageUrl: null,
          slug: "arroz-cigala-agulha",
          category: "Mercearia",
        },
        {
          id: "pd-esparguete-milaneza-500g",
          name: "Esparguete Milaneza 500 g",
          brand: "Milaneza",
          ean: "5601010000062",
          regularPrice: "0,95",
          imageUrl: null,
          slug: "esparguete-milaneza",
          category: "Mercearia",
        },
        {
          id: "pd-cafe-delta-250g",
          name: "Café Moído Delta 250 g",
          brand: "Delta",
          ean: "5601010000116",
          regularPrice: "2,89",
          imageUrl: null,
          slug: "cafe-moido-delta",
          category: "Mercearia",
        },
      ],
      bebidas: [
        {
          id: "pd-coca-cola-1.5l",
          name: "Coca-Cola 1,5 L",
          brand: "Coca-Cola",
          ean: "5449000000996",
          regularPrice: "1,95",
          imageUrl: null,
          slug: "coca-cola-1-5l",
          category: "Bebidas",
        },
        {
          id: "pd-cerveja-superbock-6x33",
          name: "Cerveja Super Bock 6x33 cl",
          brand: "Super Bock",
          ean: "5601010000123",
          regularPrice: "3,39",
          promoPrice: "2,99",
          imageUrl: null,
          slug: "cerveja-super-bock",
          category: "Bebidas",
        },
      ],
      limpeza: [
        {
          id: "pd-skip-1.5l",
          name: "Detergente Líquido Roupa Skip 1,5 L",
          brand: "Skip",
          ean: "5601010000086",
          regularPrice: "7,79",
          imageUrl: null,
          slug: "detergente-skip",
          category: "Limpeza",
        },
      ],
    };
    return samples[category] ?? [];
  }
}

// Forma (parcial e tolerante) do item devolvido pelo Pingo Doce.
interface PingoDoceRawItem {
  id?: string;
  sku?: string;
  name?: string;
  title?: string;
  brand?: string;
  ean?: string;
  gtin?: string;
  barcode?: string;
  regularPrice?: string | number;
  promoPrice?: string | number;
  salePrice?: string | number;
  price?: {
    value?: number;
    promotion?: { value?: number };
  } | string | number;
  unitPrice?: string | number;
  unitPriceUom?: string;
  pricePerUnit?: string | number;
  pricePerUnitUom?: string;
  imageUrl?: string | null;
  image?: { url?: string };
  url?: string;
  slug?: string;
  category?: string;
  quantityText?: string;
}

interface PingoDoceGtmInfo {
  value?: number;
  currency?: string;
  items?: PingoDoceGtmItem[];
}

interface PingoDoceGtmItem {
  item_id?: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  discount?: number;
}

export function parsePingoDoceGridHtml(html: string): PingoDoceRawItem[] {
  const items: PingoDoceRawItem[] = [];
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

function parseProductBlock(block: string): PingoDoceRawItem | null {
  const gtm = parseHtmlJsonAttribute<PingoDoceGtmInfo>(
    extractAttribute(block, "data-gtm-info"),
  );
  const gtmItem = gtm?.items?.[0];
  const pid = extractProductId(block) ?? gtmItem?.item_id;
  // Precos de microdata (atributo content, ex.: "1.79") — mais fiaveis que o
  // texto e que o desconto GTM (que vem a 0 mesmo havendo preco riscado).
  const microSale = extractMicrodataPrice(block, "sales");
  const microList = extractMicrodataPrice(block, "strike-through");
  const salePrice =
    microSale ?? gtmItem?.price ?? gtm?.value ?? parsePrice(extractPriceText(block));
  const productNameText =
    gtmItem?.item_name ?? cleanHtmlText(extractClassBody(block, "product-name-link"));

  if (!pid || !productNameText || salePrice == null) return null;

  const discount = Number(gtmItem?.discount ?? 0);
  const listFromDiscount = discount > 0 ? round(salePrice + discount) : null;
  const listPrice = microList ?? listFromDiscount ?? salePrice;
  const hasPromo = listPrice > salePrice;
  const unitPpu = parseUnitPriceLabel(cleanHtmlText(extractClassBody(block, "product-unit")));
  const pricePerUnitText = extractUnitPriceText(block);

  return {
    id: pid,
    name: decodeHtmlEntities(productNameText),
    brand: decodeHtmlEntities(
      gtmItem?.item_brand ?? cleanHtmlText(extractClassBody(block, "product-brand-name")) ?? "",
    ),
    regularPrice: listPrice,
    promoPrice: hasPromo ? salePrice : undefined,
    pricePerUnit: unitPpu?.value ?? pricePerUnitText ?? undefined,
    pricePerUnitUom: unitPpu?.uom ?? pricePerUnitText ?? undefined,
    imageUrl: extractImageUrl(block) ?? undefined,
    url: extractProductUrl(block) ?? undefined,
    category: decodeHtmlEntities(gtmItem?.item_category ?? ""),
    quantityText: cleanHtmlText(extractClassBody(block, "product-unit")) ?? undefined,
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

function extractPriceText(block: string): string | null {
  const segment = extractBetweenClasses(block, "product-price", "product-cta");
  return cleanHtmlText(segment);
}

function extractUnitPriceText(block: string): string | null {
  const priceText = extractPriceText(block);
  if (!priceText || !/\/\s*(kg|l|lt|litro)/i.test(priceText)) return null;
  return priceText;
}

function extractBetweenClasses(block: string, startClass: string, endClass: string): string | null {
  const classStart = block.search(new RegExp(startClass, "i"));
  if (classStart < 0) return null;

  const tagStart = Math.max(0, block.lastIndexOf("<", classStart));
  const afterStart = block.slice(tagStart);
  const endAt = afterStart.search(new RegExp(endClass, "i"));
  if (endAt > 0) {
    const endTagStart = Math.max(0, afterStart.lastIndexOf("<", endAt));
    return afterStart.slice(0, endTagStart);
  }
  return afterStart.slice(0, 500);
}

function extractProductUrl(block: string): string | null {
  const match = block.match(
    /<a[^>]+class=(["'])[^"']*product-tile-image-link[^"']*\1[^>]+href=(["'])([^"']+)\2/i,
  );
  return match ? decodeHtmlEntities(match[3]) : null;
}

function extractImageUrl(block: string): string | null {
  const match = block.match(
    /<img[^>]+class=(["'])[^"']*product-tile-component-image[^"']*\1[^>]+(?:src|data-src)=(["'])([^"']+)\2/i,
  );
  return match ? decodeHtmlEntities(match[3]) : null;
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
