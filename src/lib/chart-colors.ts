import type { Supermarket } from "@/lib/types";

/**
 * Cores do grafico: a identidade de marca de varias cadeias e vermelha ou
 * verde, o que torna linhas sobrepostas ilegíveis. Esta paleta e so para o
 * historico (os pontos/chips nas restantes paginas continuam com a cor da marca).
 */
const CHART_COLORS: Record<string, string> = {
  continente: "#e11d48",
  "pingo-doce": "#16a34a",
  aldi: "#2563eb",
  intermarche: "#f59e0b",
  lidl: "#0891b2",
  auchan: "#7c3aed",
  mercadona: "#65a30d",
  minipreco: "#94a3b8",
};

export function chartColor(supermarket: Pick<Supermarket, "slug" | "colorHex">): string {
  return CHART_COLORS[supermarket.slug] ?? supermarket.colorHex ?? "#64748b";
}
