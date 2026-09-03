import { cache as reactCache } from "react";
import { getRepository } from "@/db/repository";
import type {
  Category,
  PlatformStats,
  ProductWithOffers,
  Supermarket,
  SupermarketSummary,
} from "@/lib/types";
import { TtlCache } from "@/lib/api-cache";
import { loadLiveCatalog } from "@/db/live-catalog";

/**
 * Acesso a dados para Server Components com cache em processo de curta duracao.
 *
 * Os precos mudam uma vez por dia, por isso uma janela de 60 s evita queries
 * repetidas ao Postgres em cada pedido (header/footer/home) sem comprometer a
 * frescura. Em modo demo (memoria) o custo e residual mas mantem-se a mesma API.
 */
const cache = new TtlCache<unknown>(60_000, 50);

async function memo<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const { value } = await cache.getOrSet(key, loader as () => Promise<unknown>);
  return value as T;
}

export function getCachedSupermarkets(): Promise<Supermarket[]> {
  return memo("supermarkets", () => getRepository().getSupermarkets());
}

export async function getActiveSupermarkets(): Promise<Supermarket[]> {
  const all = await getCachedSupermarkets();
  return all.filter((s) => s.isActive);
}

export function getCachedCategories(): Promise<Category[]> {
  return memo("categories", () => getRepository().getCategories());
}

export function getCachedStats(): Promise<PlatformStats> {
  return memo("stats", () => getRepository().getStats());
}

export function getCachedSupermarketSummaries(): Promise<SupermarketSummary[]> {
  return memo("supermarket-summaries", () => getRepository().getSupermarketSummaries());
}

export interface CategoryOverview {
  category: Category;
  productCount: number;
  promoCount: number;
  sample: ProductWithOffers[];
}

/** Resumo por categoria (contagem + amostra) para /categorias e para a home. */
export function getCategoryOverview(sampleSize = 3): Promise<CategoryOverview[]> {
  return memo(`category-overview:${sampleSize}`, async () => {
    const repo = getRepository();
    const categories = await getCachedCategories();
    const rows = await Promise.all(
      categories.map(async (category) => {
        const [all, promo] = await Promise.all([
          repo.browse({ categoryId: category.id, pageSize: sampleSize, sort: "savings" }),
          repo.browse({ categoryId: category.id, onlyPromo: true, pageSize: 1 }),
        ]);
        return { category, productCount: all.total, promoCount: promo.total, sample: all.items };
      }),
    );
    return rows.sort((a, b) => b.productCount - a.productCount || a.category.name.localeCompare(b.category.name, "pt-PT"));
  });
}

/** Id de produto valido a partir do segmento de URL (inteiro positivo). */
export function parseProductId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Produto com ofertas, deduplicado por pedido (React cache): o layout valida a
 * existencia (para o 404 sair com o status correto), `generateMetadata` e a
 * pagina reutilizam o mesmo resultado sem repetir a query.
 */
export const getProductCached = reactCache(async (globalId: number): Promise<ProductWithOffers | null> => {
  return getRepository().getProduct(globalId);
});

export async function findSupermarketBySlug(slug: string): Promise<Supermarket | null> {
  const all = await getCachedSupermarkets();
  return all.find((s) => s.slug === slug) ?? null;
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const all = await getCachedCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

/** Nome do modo de dados para mostrar em /sobre e no painel admin. */
export function dataSourceLabel(): "postgres" | "live" | "demo" {
  if (process.env.USE_DB === "true") return "postgres";
  return loadLiveCatalog() ? "live" : "demo";
}

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
