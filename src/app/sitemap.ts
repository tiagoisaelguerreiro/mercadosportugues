import type { MetadataRoute } from "next";
import { getRepository } from "@/db/repository";
import { getActiveSupermarkets, getCachedCategories, getCachedStats, siteUrl } from "@/lib/data";

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

  // Produtos: lista leve de IDs (sem compor ofertas) numa unica query.
  try {
    const ids = await getRepository().listProductIds(MAX_PRODUCTS);
    for (const id of ids) {
      entries.push({
        url: `${base}/produto/${id}`,
        lastModified,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    // Sem base de dados disponivel: devolve apenas as paginas estaticas.
  }

  return entries;
}
