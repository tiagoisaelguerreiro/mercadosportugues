import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/db/repository";
import { requireAdmin } from "@/lib/admin-auth";

const NullableText = z
  .string()
  .trim()
  .transform((v) => (v.length ? v : null))
  .nullable()
  .optional();

const CreateGlobalSchema = z.object({
  nameGlobal: z.string().trim().min(1).max(255).optional(),
  brand: NullableText,
  eanCode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/)
    .nullable()
    .optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  imageUrl: NullableText,
});

/** POST /api/admin/matches/review/:id/create-global */
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = CreateGlobalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "payload invalido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const productMarket = await getRepository().createGlobalFromReview(
    productMarketId,
    parsed.data,
  );
  if (!productMarket) {
    return NextResponse.json({ error: "match em revisao nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ productMarket });
}
