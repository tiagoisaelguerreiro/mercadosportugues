import type { ParsedQuantity, ProductGlobal, RawProduct } from "@/lib/types";
import { normalizeText, parseQuantity } from "@/lib/parsing";

// Stop words PT que nao ajudam a distinguir produtos.
const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "e",
  "a",
  "o",
  "as",
  "os",
  "para",
  "em",
  "no",
  "na",
  "pack",
  "embalagem",
  "emb",
]);

/**
 * Reduz um nome de produto a um conjunto de tokens significativos, ordenados.
 * Ordenar evita falsos negativos por ordem de palavras diferente entre lojas.
 */
export function tokenize(name: string): string[] {
  return normalizeText(name)
    .split(/\s+/)
    .map((t) => t.replace(/^\d+(?:[.,]\d+)?/, "")) // remove prefixo numerico: "1kg" -> "kg"
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+([.,]\d+)?$/.test(t))
    .sort();
}

export function canonicalKey(name: string): string {
  return tokenize(name).join(" ");
}

/**
 * Distancia de Levenshtein (iterativa, O(n*m) com 2 linhas).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similaridade normalizada (0..1) baseada em Levenshtein. */
export function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Similaridade Jaro-Winkler (0..1). Forte para nomes curtos / trocas de letras
 * e dá bonus a prefixos comuns — util para marcas.
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions) / m) / 3;

  // Bonus de prefixo (Winkler), ate 4 caracteres.
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Similaridade combinada usada para o matching de nomes:
 * media ponderada de token-set (via Levenshtein sobre chaves canonicas) e
 * Jaro-Winkler sobre o texto normalizado.
 */
export function nameSimilarity(a: string, b: string): number {
  const keyA = canonicalKey(a);
  const keyB = canonicalKey(b);
  const tokenScore = levenshteinRatio(keyA, keyB);
  // JW tambem sobre as chaves canonicas para nao penalizar ordem de palavras.
  const jwScore = jaroWinkler(keyA, keyB);
  return 0.6 * tokenScore + 0.4 * jwScore;
}

/**
 * Verifica se duas quantidades sao "o mesmo tamanho".
 * Este teste e um VETO, nao um fator de score: produtos de tamanhos
 * diferentes nunca podem ser o mesmo produto global.
 */
export function sameSize(
  a: ParsedQuantity | null,
  b: ParsedQuantity | null,
  tolerance = 0.001,
): boolean {
  // Se nenhum tem quantidade conhecida, nao bloqueamos (decide o nome).
  if (!a && !b) return true;
  // Se so um tem quantidade, nao podemos garantir igualdade -> bloqueia.
  if (!a || !b) return false;
  if (a.baseUnit !== b.baseUnit) return false;
  return Math.abs(a.baseQuantity - b.baseQuantity) <= tolerance;
}

export type MatchOutcome =
  | { status: "matched"; globalId: number; confidence: number }
  | { status: "review"; globalId: number; confidence: number }
  | { status: "orphan"; globalId: null; confidence: 0 };

export interface MatchThresholds {
  /** >= auto: junta automaticamente. */
  auto: number;
  /** >= review (e < auto): envia para revisao humana. */
  review: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  auto: 0.92,
  review: 0.8,
};

export interface MatchCandidate extends ProductGlobal {
  /** Quantidade ja parseada do produto global (cache opcional). */
  parsedQuantity?: ParsedQuantity | null;
}

/**
 * Estrategia de matching em cascata:
 *   1) EAN/codigo de barras (determinista, confianca 1.0)
 *   2) Similaridade de nome + VETO de tamanho/unidade
 *
 * `candidates` deve ser uma lista ja filtrada (ex.: por trigram no Postgres,
 * ou todos os globais no modo em memoria).
 */
export function matchProduct(
  raw: Pick<RawProduct, "name" | "ean">,
  candidates: MatchCandidate[],
  findByEan?: (ean: string) => ProductGlobal | undefined,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): MatchOutcome {
  // 1) EAN é rei.
  if (raw.ean) {
    const byEan = findByEan
      ? findByEan(raw.ean)
      : candidates.find((c) => c.eanCode === raw.ean);
    if (byEan) {
      return { status: "matched", globalId: byEan.id, confidence: 1 };
    }
  }

  // 2) Fuzzy com veto de tamanho.
  const rawQty = parseQuantity(raw.name);
  let best: { id: number; score: number } | null = null;

  for (const candidate of candidates) {
    const candQty =
      candidate.parsedQuantity !== undefined
        ? candidate.parsedQuantity
        : quantityFromGlobal(candidate);

    if (!sameSize(rawQty, candQty)) continue; // VETO

    const score = nameSimilarity(raw.name, `${candidate.brand ?? ""} ${candidate.nameGlobal}`);
    if (!best || score > best.score) {
      best = { id: candidate.id, score };
    }
  }

  if (best && best.score >= thresholds.auto) {
    return { status: "matched", globalId: best.id, confidence: best.score };
  }
  if (best && best.score >= thresholds.review) {
    return { status: "review", globalId: best.id, confidence: best.score };
  }
  return { status: "orphan", globalId: null, confidence: 0 };
}

function quantityFromGlobal(g: ProductGlobal): ParsedQuantity | null {
  if (g.quantityValue != null && g.quantityUnit != null && g.baseUnit != null && g.baseQuantity != null) {
    return {
      value: g.quantityValue,
      unit: g.quantityUnit,
      baseUnit: g.baseUnit,
      baseQuantity: g.baseQuantity,
    };
  }
  return parseQuantity(g.nameGlobal);
}
