import type { MetadataRoute } from "next";
import { getRepository } from "@/db/repository";
import { getActiveSupermarkets, getCachedCategories, getCachedStats, siteUrl } from "@/lib/data";
import { BROWSE_MAX_PAGE_SIZE } from "@/db/query-logic";

export const dynamic = "force-dynamic";

/** Limite defensivo para o sitemap ficar num unico ficheiro (< 50k URLs). */
const MAX_PRODUCTS = 20_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [categories, supermarkets, stats] = await Promise.all([
    getCachedCategories().catch(() => []),
    getActiveSupermarkets().catch(() => []),
    getCachedStats().catch(() => null),
  ]);
  const lastModified = stats?.lastCapturedAt ? new Date(stats.lastCapturedAt) : new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${base}/pesquisa`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/promocoes`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/supermercados`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/categorias`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/carrinho`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/sobre`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacidade`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    ...categories.map((c) => ({
      url: `${base}/categoria/${c.slug}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...supermarkets.map((s) => ({
      url: `${base}/supermercado/${s.slug}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  // Produtos: pagina o catalogo completo para nao carregar tudo em memoria de uma vez.
  try {
    const repo = getRepository();
    let page = 1;
    let collected = 0;
    for (;;) {
      const result = await repo.browse({ sort: "name", page, pageSize: BROWSE_MAX_PAGE_SIZE });
      for (const item of result.items) {
        entries.push({
          url: `${base}/produto/${item.product.id}`,
          lastModified,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
      collected += result.items.length;
      if (page >= result.totalPages || result.items.length === 0 || collected >= MAX_PRODUCTS) break;
      page += 1;
    }
  } catch {
    // Sem base de dados disponivel: devolve apenas as paginas estaticas.
  }

  return entries;
}
