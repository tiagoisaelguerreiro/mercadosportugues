import { resolveListingBrand } from "@/lib/matching";
import { computePricePerUnit, parsePrice, parseQuantity } from "@/lib/parsing";
import type { RawProduct } from "@/lib/types";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";
import { limitCategories } from "../core/sitemap";

/**
 * Catalogo Mercadona via API publica da loja online (tienda.mercadona.es).
 * Os precos sao os da loja online; em Portugal a cadeia partilha o mesmo
 * catalogo Hacendado. Sem EAN na listagem — o matching faz-se por nome.
 */
export class MercadonaAdapter extends BaseAdapter {
  readonly slug = "mercadona";
  readonly supermarketId = 8;

  private readonly http: HttpClient;
  private readonly dryRun: boolean;
  private readonly base = "https://tienda.mercadona.es";
  private readonly categoryListUrl = "https://tienda.mercadona.es/api/v1_1/categories/";
  private readonly fallbackIds = ["72", "118", "120", "156", "164", "104", "27", "226"];

  constructor(opts: { dryRun?: boolean; http?: HttpClient } = {}) {
    super();
    this.dryRun = opts.dryRun ?? process.env.SCRAPER_DRY_RUN !== "false";
    this.http =
      opts.http ??
      new HttpClient({
        defaultHeaders: {
          Accept: "application/json",
          Referer: `${this.base}/`,
        },
      });
  }

  async discoverCategories(): Promise<string[]> {
    if (this.dryRun) return ["leite"];
    try {
      const data = await this.http.getJson<MercadonaCategoryList>(this.categoryListUrl);
      const ids = limitCategories(collectLeafCategoryIds(data.results ?? []));
      if (ids.length > 0) return ids;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ mercadona: arvore de categorias indisponivel (${message}); a usar lista fallback`);
    }
    return this.fallbackIds;
  }

  async *fetchCategory(category: string): AsyncIterable<RawProduct> {
    const items = this.dryRun ? this.fixture() : await this.fetchCategoryJson(category);
    for (const item of items) {
      const raw = this.toRawProduct(item);
      if (raw) yield raw;
    }
  }

  private async fetchCategoryJson(id: string): Promise<MercadonaProduct[]> {
    const data = await this.http.getJson<MercadonaCategory>(`${this.base}/api/v1_1/categories/${id}/`);
    return flattenProducts(data);
  }

  private toRawProduct(item: MercadonaProduct): RawProduct | null {
    const name = [item.display_name, item.packaging].filter(Boolean).join(" ").trim();
    const unitPrice = parsePrice(item.price_instructions?.unit_price);
    if (!name || unitPrice == null) return null;
    const previous = parsePrice(item.price_instructions?.previous_unit_price);
    const hasPromo = previous != null && previous > unitPrice;
    const regular = hasPromo ? previous! : unitPrice;
    const quantity = parseQuantity(name);
    const ppu = computePricePerUnit(unitPrice, quantity);
    return {
      marketSku: String(item.id),
      name,
      brand: extractBrand(name),
      ean: null,
      priceRegular: regular,
      pricePromo: hasPromo ? unitPrice : null,
      hasPromo,
      pricePerUnit: ppu?.value ?? parsePrice(item.price_instructions?.bulk_price),
      pricePerUnitUom: ppu?.uom ?? null,
      imageUrl: item.thumbnail ?? null,
      productUrl: item.share_url ?? null,
      categoryPath: item.categories?.[0]?.name ?? null,
    };
  }

  private fixture(): MercadonaProduct[] {
    return [
      {
        id: "10381",
        display_name: "Leite Meio Gordo Hacendado 6x1L",
        packaging: null,
        thumbnail: "https://prod-mercadona.imgix.net/images/c15010ddd0e6fc881e5ef94446d43bef.jpg?fit=crop&h=300&w=300",
        share_url: "https://tienda.mercadona.es/product/10381/leche-semidesnatada-hacendado-pack-6",
        price_instructions: { unit_price: "5.04", bulk_price: "0.84" },
        categories: [{ name: "Leite" }],
      },
    ];
  }
}

interface MercadonaProduct {
  id: string | number;
  display_name?: string;
  packaging?: string | null;
  thumbnail?: string | null;
  share_url?: string | null;
  price_instructions?: {
    unit_price?: string;
    bulk_price?: string;
    previous_unit_price?: string | null;
  };
  categories?: { name?: string }[];
}

interface MercadonaCategory {
  products?: MercadonaProduct[];
  categories?: MercadonaCategory[];
}

interface MercadonaTreeNode {
  id?: string | number;
  categories?: MercadonaTreeNode[];
}

interface MercadonaCategoryList {
  results?: MercadonaTreeNode[];
}

export function collectLeafCategoryIds(nodes: MercadonaTreeNode[]): string[] {
  const leaves: string[] = [];
  const walk = (node: MercadonaTreeNode) => {
    const children = node.categories ?? [];
    if (children.length === 0) {
      if (node.id != null) leaves.push(String(node.id));
      return;
    }
    for (const child of children) walk(child);
  };
  for (const node of nodes) walk(node);
  return leaves;
}

function flattenProducts(node: MercadonaCategory | undefined): MercadonaProduct[] {
  if (!node) return [];
  const own = node.products ?? [];
  const nested = (node.categories ?? []).flatMap(flattenProducts);
  return [...own, ...nested];
}

function extractBrand(name: string): string | null {
  const resolved = resolveListingBrand(null, name, null);
  if (!resolved) return null;
  return resolved.key
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
