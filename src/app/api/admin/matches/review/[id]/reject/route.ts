import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";
import { requireAdmin } from "@/lib/admin-auth";

/** POST /api/admin/matches/review/:id/reject */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const productMarketId = Number(id);
  if (!Number.isInteger(productMarketId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  const productMarket = await getRepository().rejectReviewMatch(productMarketId);
  if (!productMarket) {
    return NextResponse.json({ error: "match em revisao nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ productMarket });
}
