import { NextRequest } from "next/server";
import { getRepository } from "@/db/repository";
import { cachedJsonGet } from "@/lib/api-route";

/** GET /api/categories — lista de categorias do catalogo. */
export async function GET(req: NextRequest) {
  return cachedJsonGet(req, ["categories"], async () => {
    const categories = await getRepository().getCategories();
    return { count: categories.length, categories };
  });
}
