import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";

/** GET /api/products/:id — produto global com todas as ofertas. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const globalId = Number(id);
  if (!Number.isInteger(globalId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }
  const product = await getRepository().getProduct(globalId);
  if (!product) {
    return NextResponse.json({ error: "produto nao encontrado" }, { status: 404 });
  }
  return NextResponse.json(product);
}
