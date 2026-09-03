import { NextRequest } from "next/server";
import { getRepository } from "@/db/repository";
import { BROWSE_DEFAULT_PAGE_SIZE, BROWSE_MAX_PAGE_SIZE } from "@/db/query-logic";
import { boolParam, cachedJsonGet, intParam } from "@/lib/api-route";
import type { BrowseSort } from "@/lib/types";

const SORTS: BrowseSort[] = ["relevance", "cheapest", "savings", "promo", "name"];

/**
 * GET /api/products/browse?q=&category=<id>&supermarket=<slug>&promo=1&sort=cheapest&page=1&pageSize=24
 * Catalogo com filtros, ordenacao e paginacao. Devolve `{ items, total, page,
 * pageSize, totalPages }` com os produtos ja compostos com ofertas.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const categoryRaw = searchParams.get("category");
  const categoryId = categoryRaw && /^\d+$/.test(categoryRaw) ? Number(categoryRaw) : null;
  const supermarketSlug = searchParams.get("supermarket")?.trim() || null;
  const onlyPromo = boolParam(searchParams, "promo");
  const sortRaw = searchParams.get("sort") as BrowseSort | null;
  const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : undefined;
  const page = intParam(searchParams, "page", 1, 1, 10_000);
  const pageSize = intParam(searchParams, "pageSize", BROWSE_DEFAULT_PAGE_SIZE, 1, BROWSE_MAX_PAGE_SIZE);

  return cachedJsonGet(
    req,
    ["browse", q.toLowerCase(), categoryId, supermarketSlug, onlyPromo, sort, page, pageSize],
    () =>
      getRepository().browse({
        query: q,
        categoryId,
        supermarketSlug,
        onlyPromo,
        sort,
        page,
        pageSize,
      }),
  );
}
