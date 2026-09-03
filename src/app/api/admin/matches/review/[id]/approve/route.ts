import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/db/repository";
import { requireAdmin } from "@/lib/admin-auth";

const ApproveSchema = z.object({
  productGlobalId: z.number().int().positive().optional(),
});

/** POST /api/admin/matches/review/:id/approve */
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

  const body = await readOptionalJson(req);
  if (body === null) {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "payload invalido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const productMarket = await getRepository().approveReviewMatch(
    productMarketId,
    parsed.data.productGlobalId,
  );
  if (!productMarket) {
    return NextResponse.json(
      { error: "match em revisao ou produto global nao encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ productMarket });
}

async function readOptionalJson(req: NextRequest): Promise<unknown | null> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
