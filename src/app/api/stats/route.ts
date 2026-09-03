import { NextRequest } from "next/server";
import { getRepository } from "@/db/repository";
import { cachedJsonGet } from "@/lib/api-route";

/**
 * GET /api/stats
 * Numeros agregados da plataforma: produtos, ofertas, promocoes, supermercados
 * ativos e data da ultima recolha de precos.
 */
export async function GET(req: NextRequest) {
  return cachedJsonGet(req, ["stats"], () => getRepository().getStats());
}
