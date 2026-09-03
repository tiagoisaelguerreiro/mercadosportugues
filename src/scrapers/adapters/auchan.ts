import type { RawProduct } from "@/lib/types";
import { computePricePerUnit, parsePrice, parseQuantity } from "@/lib/parsing";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";
import {
  absoluteUrl,
  cleanEan,
  cleanHtmlText,
  decodeHtmlEntities,
  extractAttribute,
  extractClassBody,
  extractMicrodataPrice,
  extractOpeningTag,
  normalizeUom,
  parseJsonAttribute,
  upgradeImageUrl,
  withQuantityLabel,
} from "../core/html";
import { discoverLeafCategoryPaths, limitCategories } from "../core/sitemap";

const CATEGORY_SITEMAP = "https://www.auchan.pt/sitemap_8-category.xml";
const FOOD_PREFIXES = ["/pt/alimentacao/"];
const FALLBACK_CATEGORIES = ["/pt/alimentacao/mercearia/", "/pt/alimentacao/produtos-lacteos/"];
const MAX_PAGES_PER_CATEGORY = 50;

/**
 * Adapter do Auchan (plataforma Salesforce Commerce Cloud / SFRA).
 *
 * ESTRATEGIA (confirmada em producao)
 * ----------
 * Lemos o sitemap de categorias, ficamos com as folhas em `/pt/alimentacao/`
 * e paginamos cada grelha com `?start=` (permitido pelo robots.txt) ate a
 * pagina vir vazia, incompleta ou repetir SKUs.
 *
 * Precos de microdata: `.sales .value[content]` (venda) e
 * `.auc-price__stricked .strike-through.value[content]` (riscado). Atencao ao
 * detalhe que partia a extracao por texto: spans `.sr-only` aninhados
 * ("Price reduced from ... to") — ver `extractMicrodataPrice` em core/html.
 * Preco por unidade autoritativo em `.auc-measures--price-per-unit`.
 *
 * Sem EAN na grelha — o matching faz-se por nome + veto de tamanho.
 */
export class AuchanAdapter extends BaseAdapter {
  readonly slug = "auchan";
  readonly supermarketId = 6;

  private readonly base = "https://www.auchan.pt";
  private readonly pageSize: number;
  private readonly http: HttpClient;
  private readonly dryRun: boolean;

  constructor(opts: { dryRun?: boolean; http?: HttpClient; pageSize?: number } = {}) {
    super();
    this.dryRun = opts.dryRun ?? process.env.SCRAPER_DRY_RUN !== "false";
    this.pageSize = opts.pageSize ?? 24;
    this.http =
      opts.http ??
      new HttpClient({
        defaultHeaders: {
          Accept: "text/html,application/xhtml+xml,*/*",
          Referer: `${this.base}/`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
  }

  async discoverCategories(): Promise<string[]> {
    if (this.dryRun) return ["mercearia", "laticinios", "bebidas", "limpeza"];
    try {
      const xml = await this.http.getText(CATEGORY_SITEMAP);
      const paths = limitCategories(
        discoverLeafCategoryPaths(xml, { pathPrefixes: FOOD_PREFIXES, skipQuery: true }),
      );
      if (paths.length > 0) return paths;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ auchan: sitemap indisponivel (${message}); a usar lista fallback`);
    }
    return FALLBACK_CATEGORIES;
  }

  async *fetchCategory(category: string): AsyncIterable<RawProduct> {
    let start = 0;
    const seen = new Set<string>();
    for (let page = 0; page < MAX_PAGES_PER_CATEGORY; page++) {
      const items = await this.fetchPage(category, start);
      if (items.length === 0) break;
      let fresh = 0;
      for (const item of items) {
        const raw = this.toRawProduct(item);
        if (!raw || seen.has(raw.marketSku)) continue;
        seen.add(raw.marketSku);
        fresh += 1;
        yield raw;
      }
      if (fresh === 0) break;
      if (items.length < this.pageSize) break;
      start += this.pageSize;
    }
  }

  /** Ponto unico de integracao com o site real; em dry-run devolve fixtures. */
  private async fetchPage(category: string, start: number): Promise<AuchanRawItem[]> {
    if (this.dryRun) return this.fixturePage(category, start);
    const url = absoluteUrl(this.base, category);
    const html = start > 0 ? await this.http.getText(url, { start }) : await this.http.getText(url);
    return parseAuchanGridHtml(html);
  }

  private toRawProduct(item: AuchanRawItem): RawProduct | null {
    const productName = item.name?.trim();
    const name = productName ? withQuantityLabel(productName, item.quantityText) : null;
    if (!name) return null;

    const salePrice = parsePrice(item.salePrice);
    const listPrice = parsePrice(item.listPrice);
    const regular =
      listPrice != null && salePrice != null && listPrice > salePrice ? listPrice : (salePrice ?? listPrice);
    if (regular == null) return null;

    const hasPromo = salePrice != null && listPrice != null && salePrice < listPrice;
    const effective = hasPromo ? salePrice! : regular;

    const quantity = parseQuantity(name);
    let ppuValue = parsePrice(item.pricePerUnit);
    let ppuUom = normalizeUom(item.pricePerUnit);
    if (ppuValue == null || ppuUom == null) {
      const computed = computePricePerUnit(effective, quantity);
      ppuValue = computed?.value ?? null;
      ppuUom = computed?.uom ?? null;
    }

    return {
      marketSku: String(item.id ?? item.ean ?? name),
      name,
      brand: item.brand?.trim() || null,
      ean: cleanEan(item.ean),
      priceRegular: regular,
      pricePromo: hasPromo ? salePrice! : null,
      hasPromo,
      pricePerUnit: ppuValue,
      pricePerUnitUom: ppuUom,
      imageUrl: upgradeImageUrl(item.imageUrl ?? null),
      productUrl: item.url ? absoluteUrl(this.base, item.url) : null,
      categoryPath: item.category ?? null,
    };
  }

  // ── Fixture deterministica para dry-run / desenvolvimento ──────────────────
  private fixturePage(category: string, start: number): AuchanRawItem[] {
    if (start > 0) return [];
    const samples: Record<string, AuchanRawItem[]> = {
      laticinios: [
        {
          id: "auc-leite-mimosa-1l",
          name: "Leite UHT Meio Gordo Mimosa 1 L",
          brand: "Mimosa",
          ean: "5601010000017",
          listPrice: "0,93",
          salePrice: "0,90",
          imageUrl: null,
          url: "/leite-uht-meio-gordo-mimosa/p",
          category: "Laticínios",
        },
        {
          id: "auc-iogurte-natural-4x125",
          name: "Iogurte Natural Auchan 4x125 g",
          brand: "Auchan",
          ean: "5601010000109",
          listPrice: "1,15",
          salePrice: "0,99",
          imageUrl: null,
          url: "/iogurte-natural-auchan/p",
          category: "Laticínios",
        },
      ],
      mercearia: [
        {
          id: "auc-arroz-cigala-1kg",
          name: "Arroz Agulha Cigala 1 kg",
          brand: "Cigala",
          ean: "5601010000024",
          listPrice: "1,42",
          imageUrl: null,
          url: "/arroz-agulha-cigala/p",
          category: "Mercearia",
        },
        {
          id: "auc-cafe-delta-250g",
          name: "Café Moído Delta Lote Chávena 250 g",
          brand: "Delta",
          ean: "5601010000116",
          listPrice: "2,85",
          imageUrl: null,
          url: "/cafe-moido-delta/p",
          category: "Mercearia",
        },
      ],
      bebidas: [
        {
          id: "auc-coca-cola-1.5l",
          name: "Refrigerante com Gás Cola Coca-Cola 1,5 L",
          brand: "Coca-Cola",
          ean: "5449000000996",
          listPrice: "1,98",
          imageUrl: null,
          url: "/coca-cola-1-5l/p",
          category: "Bebidas",
        },
      ],
      limpeza: [
        {
          id: "auc-skip-1.5l",
          name: "Detergente Líquido Máquina Roupa Skip 1,5 L",
          brand: "Skip",
          ean: "5601010000086",
          listPrice: "7,69",
          salePrice: "6,99",
          imageUrl: null,
          url: "/detergente-skip/p",
          category: "Limpeza",
        },
      ],
    };
    return samples[category] ?? [];
  }
}

// Forma (parcial e tolerante) de um item da grelha do Auchan.
export interface AuchanRawItem {
  id?: string;
  name?: string;
  brand?: string;
  ean?: string;
  listPrice?: string | number;
  salePrice?: string | number;
  pricePerUnit?: string;
  imageUrl?: string | null;
  url?: string;
  category?: string;
  quantityText?: string;
}

interface AuchanAnalyticsProduct {
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
  price?: number | string;
  ean?: string;
  gtin?: string;
}

export function parseAuchanGridHtml(html: string): AuchanRawItem[] {
  const items: AuchanRawItem[] = [];
  for (const block of splitProductBlocks(html)) {
    const item = parseProductBlock(block);
    if (item) items.push(item);
  }
  return items;
}

function splitProductBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re =
    /<div[^>]*class=(["'])[^"']*\bproduct\b[^"']*\1[^>]*data-pid=(["'])[^"']+\2[^>]*>[\s\S]*?(?=<div[^>]*class=(["'])[^"']*\bproduct\b[^"']*\3[^>]*data-pid=|<div[^>]*class=(["'])[^"']*(?:show-more|grid-footer)[^"']*\4|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function parseProductBlock(block: string): AuchanRawItem | null {
  const analytics =
    parseJsonAttribute<AuchanAnalyticsProduct>(extractAttribute(block, "data-gtm-product")) ??
    parseJsonAttribute<AuchanAnalyticsProduct>(
      extractAttribute(block, "data-product-tile-impression"),
    );

  const pid = extractAttribute(block, "data-pid") ?? analytics?.id;
  const pdpAnchor = extractPdpAnchor(block);
  const nameText =
    cleanHtmlText(pdpAnchor?.text) ??
    cleanHtmlText(extractClassBody(block, "auc-product-tile__name")) ??
    analytics?.name;
  const salePrice = priceFromValueTag(block, "sales") ?? parsePrice(analytics?.price);
  if (!pid || !nameText || salePrice == null) return null;

  const listPrice = priceFromValueTag(block, "strike-through");
  const ppuText =
    cleanHtmlText(extractClassBody(block, "auc-measures--price-per-unit")) ??
    cleanHtmlText(extractClassBody(block, "price-per-unit"));

  return {
    id: pid,
    name: decodeHtmlEntities(nameText),
    brand: decodeHtmlEntities(
      analytics?.brand ?? cleanHtmlText(extractClassBody(block, "auc-product-tile__brand")) ?? "",
    ),
    ean: analytics?.ean ?? analytics?.gtin,
    listPrice: listPrice ?? undefined,
    salePrice,
    pricePerUnit: ppuText ?? undefined,
    imageUrl: extractImageUrl(block) ?? undefined,
    url: pdpAnchor?.href ?? extractFirstHref(block) ?? undefined,
    category: decodeHtmlEntities(analytics?.category ?? ""),
    quantityText: cleanHtmlText(extractClassBody(block, "auc-product-tile__quantity")) ?? undefined,
  };
}

/**
 * Le o preco de um bloco `.<className> ... <span class="value" content="1.99">`.
 * Usa microdata (`content`) primeiro — robusto a spans `.sr-only` aninhados —
 * e o texto como fallback.
 */
function priceFromValueTag(block: string, className: string): number | null {
  return (
    extractMicrodataPrice(block, className) ??
    parsePrice(cleanHtmlText(extractClassBody(block, className)))
  );
}

/** Ancora do nome do produto dentro de `.pdp-link` (SFRA): texto + href. */
function extractPdpAnchor(block: string): { text: string; href: string | null } | null {
  const start = block.search(/<[^>]*class=(["'])[^"']*pdp-link[^"']*\1/i);
  if (start < 0) return null;
  const match = block.slice(start).match(/<a([^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const href = extractAttribute(match[1], "href");
  return { text: match[2], href: href ? decodeHtmlEntities(href) : null };
}

function extractFirstHref(block: string): string | null {
  const match = block.match(/<a[^>]+href=(["'])([^"']+)\1/i);
  return match ? decodeHtmlEntities(match[2]) : null;
}

function extractImageUrl(block: string): string | null {
  const imgTag = extractOpeningTag(block, "tile-image");
  if (!imgTag) return null;
  const url = extractAttribute(imgTag, "data-src") ?? extractAttribute(imgTag, "src");
  return url ? decodeHtmlEntities(url) : null;
}
