import type { BaseUnit, ParsedQuantity, QuantityUnit } from "@/lib/types";

/**
 * Remove acentos/diacriticos de uma string (NFD + strip combining marks).
 * Equivalente leve ao `unidecode` para o caso de uso PT.
 */
export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza texto para comparacao: minusculas, sem acentos, sem pontuacao.
 */
export function normalizeText(input: string): string {
  return stripAccents(input.toLowerCase())
    .replace(/[^a-z0-9\s.]/g, " ") // mantem ponto decimal, remove restante pontuacao
    .replace(/\s+/g, " ")
    .trim();
}

// Conversao de cada unidade para a sua unidade base.
const UNIT_TO_BASE: Record<QuantityUnit, { base: BaseUnit; factor: number }> = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  L: { base: "L", factor: 1 },
  ml: { base: "L", factor: 0.001 },
  cl: { base: "L", factor: 0.01 },
  un: { base: "un", factor: 1 },
};

// Aliases textuais encontrados nos sites -> unidade canonica.
const UNIT_ALIASES: Record<string, QuantityUnit> = {
  kg: "kg",
  kgs: "kg",
  quilo: "kg",
  quilos: "kg",
  g: "g",
  gr: "g",
  grs: "g",
  grama: "g",
  gramas: "g",
  l: "L",
  lt: "L",
  lts: "L",
  litro: "L",
  litros: "L",
  ml: "ml",
  mls: "ml",
  cl: "cl",
  un: "un",
  und: "un",
  uni: "un",
  unid: "un",
  unidade: "un",
  unidades: "un",
  doses: "un",
  dose: "un",
  capsulas: "un",
  rolos: "un",
};

/**
 * Extrai quantidade e unidade do nome de um produto.
 *
 * Lida com:
 *   - "Leite UHT Mimosa 1L"         -> 1 L
 *   - "Arroz Cigala 1kg"            -> 1 kg
 *   - "Iogurte 4x125g"              -> 500 g  (multipack expandido)
 *   - "Agua 6x1.5L"                 -> 9 L
 *   - "Ovos Classe M 6 un"          -> 6 un
 *   - "Detergente 500 ml"           -> 500 ml
 *
 * Devolve `null` se nao encontrar quantidade reconhecivel.
 */
export function parseQuantity(name: string): ParsedQuantity | null {
  const text = stripAccents(name.toLowerCase()).replace(/,/g, ".");

  // Padrao multipack: "<n>x<valor><unidade>"  (ex.: 6x1.5l, 4 x 125 g)
  const multipack = text.match(
    /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-zç]+)/i,
  );
  if (multipack) {
    const count = parseInt(multipack[1], 10);
    const each = parseFloat(multipack[2]);
    const unit = resolveUnit(multipack[3]);
    if (unit && count > 0 && each > 0) {
      return buildQuantity(count * each, unit);
    }
  }

  // Padrao simples: "<valor><unidade>"  (ex.: 1kg, 500 g, 1.5 l, 6 un)
  // Procura todas as ocorrencias e fica com a ultima reconhecida
  // (normalmente a quantidade aparece no fim do nome).
  const simpleRe = /(\d+(?:\.\d+)?)\s*([a-zç]+)/gi;
  let match: RegExpExecArray | null;
  let last: ParsedQuantity | null = null;
  while ((match = simpleRe.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    const unit = resolveUnit(match[2]);
    if (unit && value > 0) {
      last = buildQuantity(value, unit);
    }
  }
  return last;
}

function resolveUnit(token: string): QuantityUnit | null {
  return UNIT_ALIASES[token.toLowerCase()] ?? null;
}

function buildQuantity(value: number, unit: QuantityUnit): ParsedQuantity {
  const { base, factor } = UNIT_TO_BASE[unit];
  return {
    value,
    unit,
    baseUnit: base,
    baseQuantity: round(value * factor, 4),
  };
}

/**
 * Converte um preco e uma string PT (ex.: "1,29 €", "€2.50") num numero.
 * Devolve `null` se nao conseguir interpretar.
 */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const cleaned = input
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "") // remove separador de milhares
    .replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calcula o preco por unidade base (€/kg ou €/L) dado o preco efetivo e a quantidade.
 * Devolve `null` para produtos contados a unidade ('un') ou sem quantidade.
 */
export function computePricePerUnit(
  effectivePrice: number,
  quantity: ParsedQuantity | null,
): { value: number; uom: BaseUnit } | null {
  if (!quantity || quantity.baseUnit === "un" || quantity.baseQuantity <= 0) {
    return null;
  }
  return {
    value: round(effectivePrice / quantity.baseQuantity, 4),
    uom: quantity.baseUnit,
  };
}
