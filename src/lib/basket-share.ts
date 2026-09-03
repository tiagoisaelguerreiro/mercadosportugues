import type { BasketLine } from "@/lib/types";

export const BASKET_SHARE_PARAM = "itens";
const MAX_LINES = 100;
const MAX_QUANTITY = 99;

/**
 * Codifica o carrinho de forma compacta e legivel para a URL:
 * `12x2,45,7x3` => produto 12 (2 un.), produto 45 (1 un.), produto 7 (3 un.).
 */
export function encodeBasket(lines: BasketLine[]): string {
  return lines
    .filter((l) => Number.isInteger(l.productGlobalId) && l.productGlobalId > 0 && l.quantity > 0)
    .slice(0, MAX_LINES)
    .map((l) => (l.quantity === 1 ? String(l.productGlobalId) : `${l.productGlobalId}x${Math.min(MAX_QUANTITY, Math.floor(l.quantity))}`))
    .join(",");
}

/** Inverso de `encodeBasket`; ignora entradas invalidas e funde duplicados. */
export function decodeBasket(raw: string | null | undefined): BasketLine[] {
  if (!raw) return [];
  const byId = new Map<number, number>();
  for (const part of raw.split(",")) {
    const m = part.trim().match(/^(\d+)(?:x(\d+))?$/i);
    if (!m) continue;
    const id = Number(m[1]);
    const qty = m[2] ? Number(m[2]) : 1;
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0) continue;
    byId.set(id, Math.min(MAX_QUANTITY, (byId.get(id) ?? 0) + qty));
    if (byId.size >= MAX_LINES) break;
  }
  return [...byId.entries()].map(([productGlobalId, quantity]) => ({ productGlobalId, quantity }));
}

export function basketShareUrl(origin: string, lines: BasketLine[]): string {
  const encoded = encodeBasket(lines);
  return encoded ? `${origin}/carrinho?${BASKET_SHARE_PARAM}=${encodeURIComponent(encoded)}` : `${origin}/carrinho`;
}
