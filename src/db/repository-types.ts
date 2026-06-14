import type {
  BasketComparison,
  BasketLine,
  Category,
  HistoryPoint,
  PriceDrop,
  ProductWithOffers,
  Supermarket,
} from "@/lib/types";

export interface HistoryResult {
  supermarkets: Supermarket[];
  points: HistoryPoint[];
}

/**
 * Contrato de acesso a dados da plataforma.
 *
 * Todos os metodos sao assincronos para que a mesma interface sirva tanto a
 * implementacao em memoria (dados seed) como a implementacao PostgreSQL (queries
 * reais via Drizzle). A API e o frontend dependem apenas desta interface — trocar
 * a origem dos dados nao requer mudancas nas rotas nem nos componentes.
 */
export interface Repository {
  getSupermarkets(): Promise<Supermarket[]>;
  getCategories(): Promise<Category[]>;
  getProduct(globalId: number): Promise<ProductWithOffers | null>;
  search(query: string, limit?: number): Promise<ProductWithOffers[]>;
  getHistory(globalId: number, days?: number): Promise<HistoryResult>;
  biggestDrops(limit?: number): Promise<PriceDrop[]>;
  compareBasket(lines: BasketLine[]): Promise<BasketComparison>;
}

/**
 * Reduz uma serie temporal a no maximo `maxPoints`, amostrando a intervalos
 * regulares e preservando sempre o primeiro e o ultimo ponto. Mantem o grafico
 * legivel em periodos longos (ex.: 1 ano) sem perder a tendencia.
 */
export function downsample(points: HistoryPoint[], maxPoints: number): HistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  if (out[out.length - 1] !== points[points.length - 1]) {
    out[out.length - 1] = points[points.length - 1];
  }
  return out;
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
