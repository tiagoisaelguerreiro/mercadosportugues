import { NextRequest } from "next/server";
import { getRepository } from "@/db/repository";
import { cachedJsonGet } from "@/lib/api-route";

/**
 * GET /api/supermarkets
 * Supermercados ativos com o respetivo resumo comparativo (ofertas, promocoes,
 * vezes mais barato e indice de preco), ordenados do mais barato ao mais caro.
 */
export async function GET(req: NextRequest) {
  return cachedJsonGet(req, ["supermarkets"], async () => {
    const summaries = await getRepository().getSupermarketSummaries();
    return { count: summaries.length, supermarkets: summaries };
  });
}
