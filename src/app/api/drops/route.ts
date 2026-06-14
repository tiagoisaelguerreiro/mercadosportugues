import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/db/repository";

/** GET /api/drops?limit=8 — as maiores descidas de preco do dia. */
export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 8;
  const drops = getRepository().biggestDrops(limit);
  return NextResponse.json({ count: drops.length, drops });
}
