import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";

/**
 * GET /api/products/:id/history?days=30
 * Devolve o historico de precos dos ultimos N dias, agregado por supermercado,
 * pronto para alimentar o grafico de evolucao.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const globalId = Number(id);
  if (!Number.isInteger(globalId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const daysParam = Number(searchParams.get("days") ?? 30);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;

  const repo = getRepository();
  const product = repo.getProduct(globalId);
  if (!product) {
    return NextResponse.json({ error: "produto nao encontrado" }, { status: 404 });
  }

  const history = repo.getHistory(globalId, days);
  return NextResponse.json({
    productId: globalId,
    productName: product.product.nameGlobal,
    days,
    supermarkets: history.supermarkets,
    points: history.points,
  });
}
