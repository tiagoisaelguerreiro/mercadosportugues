import { resolveListingBrand } from "@/lib/matching";
import { computePricePerUnit, parsePrice, parseQuantity } from "@/lib/parsing";
import type { BaseUnit, RawProduct } from "@/lib/types";
import { BaseAdapter } from "../core/base-adapter";
import { HttpClient } from "../core/http-client";
import { limitCategories } from "../core/sitemap";

/**
 * Catalogo Mercadona via API publica da loja online (tienda.mercadona.es).
 *
 * ENDPOINTS (confirmados em producao, sem autenticacao)
 * ----------
 *   GET /api/categories/      -> arvore de categorias
 *   GET /api/categories/{id}/ -> categoria com produtos inline
 * (O prefixo /api/v1_1/ devolve o mesmo; usamos /api/.)
 *
 * Cada produto traz `price_instructions` com `unit_price` (preco total),
 * `bulk_price` + `reference_format` (preco por unidade autoritativo, ex.: L),
 * `previous_unit_price` e `price_decreased` (deteccao de promos).
 *
 * Notas:
 *   - Sem EAN na listagem — o matching faz-se por nome + veto de tamanho.
 *   - Nomes e precos sao os de Espanha (IVA 21%); o sortido Hacendado e
 *     partilhado com Portugal, mas os precos PT podem diferir ligeiramente.
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
    // bulk_price e o preco por unidade de referencia da API; reference_format
    // (ex.: "L") diz a unidade — autoritativo quando o nome nao a revela.
    const refUom = mapReferenceUom(
      item.price_instructions?.reference_format ?? item.price_instructions?.size_format,
    );
    return {
      marketSku: String(item.id),
      name,
      brand: extractBrand(name),
      ean: null,
      priceRegular: regular,
      pricePromo: hasPromo ? unitPrice : null,
      hasPromo,
      pricePerUnit: ppu?.value ?? parsePrice(item.price_instructions?.bulk_price),
      pricePerUnitUom: ppu?.uom ?? refUom,
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
    reference_price?: string | null;
    reference_format?: string | null;
    size_format?: string | null;
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

/**
 * Converte o formato de referencia da API Mercadona (ex.: "L", "l", "kg", "ud")
 * na unidade base do dominio. O bulk_price da API ja vem nessa unidade.
 */
export function mapReferenceUom(format: string | null | undefined): BaseUnit | null {
  const f = (format ?? "").trim().toLowerCase();
  if (!f) return null;
  if (f === "l" || f === "lt" || f === "litro" || f === "liter") return "L";
  if (f === "kg" || f === "kilo") return "kg";
  if (f === "ud" || f === "un" || f === "unid" || f === "unidade" || f === "dose") return "un";
  return null;
}

function extractBrand(name: string): string | null {
  const resolved = resolveListingBrand(null, name, null);
  if (!resolved) return null;
  return resolved.key
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
