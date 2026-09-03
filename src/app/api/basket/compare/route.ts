import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/db/repository";
import { appendRateLimitHeaders, checkPublicRateLimit } from "@/lib/rate-limit";

const BasketSchema = z.object({
  items: z
    .array(
      z.object({
        productGlobalId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99).default(1),
      }),
    )
    .min(1, "o carrinho precisa de pelo menos um produto")
    .max(100),
});

/**
 * POST /api/basket/compare
 * Body: { items: [{ productGlobalId, quantity }] }
 * Calcula o custo total do carrinho em cada supermercado e destaca o vencedor
 * (o mais barato que tem todos os itens; caso nenhum tenha tudo, o mais barato
 * entre os que tem mais itens).
 */
export async function POST(req: NextRequest) {
  const rateLimit = checkPublicRateLimit(req, "POST");
  if (rateLimit.response) return rateLimit.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BasketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "payload invalido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const comparison = await repo.compareBasket(
    parsed.data.items.map((i) => ({
      productGlobalId: i.productGlobalId,
      quantity: i.quantity,
    })),
  );

  const res = NextResponse.json(comparison);
  return appendRateLimitHeaders(res, rateLimit.result);
}
