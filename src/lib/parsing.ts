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
  dos: "un",
  capsulas: "un",
  rolos: "un",
};

/**
 * Remove ruido dos nomes das lojas para matching e parse de quantidade:
 * preco por unidade (`| 0,90 €/L`), peso escorrido, `120 (84)g`.
 */
export function cleanOfferName(name: string): string {
  return name
    .replace(/&ordm;|&#186;|&deg;/gi, "o")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\|[^|\n]*€[^|\n]*/gi, " ")
    .replace(/\(\s*peso escorrido[^)]*\)/gi, " ")
    .replace(
      /(\d+(?:[.,]\d+)?)\s*\(\s*\d+(?:[.,]\d+)?\s*\)\s*(kg|g|gr|l|ml|cl)\b/gi,
      "$1 $2",
    )
    .replace(/\s+/g, " ")
    .trim();
}

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
  const text = stripAccents(cleanOfferName(name).toLowerCase()).replace(/,/g, ".");

  if (/\b(?:uma\s+)?duzia\b/.test(text) && !/\d+\s*(kg|g|l|ml|cl)\b/.test(text)) {
    return buildQuantity(12, "un");
  }

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

  const packCount = text.match(/\bpack[\s.-]*(\d+)\b/i);
  if (packCount) {
    const count = parseInt(packCount[1], 10);
    if (count > 1) return buildQuantity(count, "un");
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

/**
 * Numero de unidades num pack ("24 x 25 cl", "Pack 24").
 * Serve para ligar a mesma referencia quando uma loja indica o volume total
 * e outra so o numero de unidades.
 */
export function parsePackCount(name: string): number | null {
  const text = stripAccents(cleanOfferName(name).toLowerCase()).replace(/,/g, ".");
  const multipack = text.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-zç]+)/i);
  if (multipack) {
    const count = parseInt(multipack[1], 10);
    if (count > 1) return count;
  }
  const pack = text.match(/\bpack[\s.-]*(\d+)\b/i);
  if (pack) {
    const count = parseInt(pack[1], 10);
    if (count > 1) return count;
  }
  return null;
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
 * Valida um codigo de barras EAN-8/EAN-13 pelo digito de controlo.
 * Rejeita sequencias triviais (ex.: so zeros) e comprimentos invalidos.
 * Essencial antes de guardar EANs extraidos de HTML — evita "colar" produtos
 * diferentes com um codigo aparentemente valido mas errado.
 */
export function isValidEan(code: string | null | undefined): boolean {
  if (!code) return false;
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 8 && digits.length !== 13) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const body = digits.slice(0, -1).split("").map(Number);
  const check = Number(digits[digits.length - 1]);
  // EAN-13: posicoes impares x1, pares x3. EAN-8: impares x3, pares x1.
  const weights = digits.length === 13 ? [1, 3] : [3, 1];
  const sum = body.reduce((acc, d, i) => acc + d * weights[i % 2], 0);
  return (10 - (sum % 10)) % 10 === check;
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
