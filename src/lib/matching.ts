import type { ParsedQuantity, ProductGlobal, RawProduct } from "@/lib/types";
import { cleanOfferName, normalizeText, parsePackCount, parseQuantity } from "@/lib/parsing";

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
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

const NOISE_TOKENS = new Set([
  "uht",
  "kg",
  "kgs",
  "gr",
  "grs",
  "lt",
  "lts",
  "ml",
  "cl",
  "un",
  "und",
  "unid",
  "pack",
  "mega",
  "int",
  "tipo",
  "essencial",
  "biologico",
  "bio",
  "longo",
  "branqueado",
  "gluten",
  "pasteurizado",
  "especial",
  "premium",
  "gourmet",
  "equilibrio",
  "equilibrado",
]);

const TOKEN_SYNONYMS: Record<string, string> = {
  leche: "leite",
  yogur: "iogurte",
  yogurt: "iogurte",
  azucar: "acucar",
  acucarado: "acucar",
  mantequilla: "manteiga",
  huevos: "ovos",
  huevo: "ovos",
  cerveza: "cerveja",
  atun: "atum",
  harina: "farinha",
  pasta: "massa",
  spaghetti: "esparguete",
  spaguetti: "esparguete",
  semidesnatada: "meiogordo",
  semidesnatado: "meiogordo",
  desnatada: "magro",
  desnatado: "magro",
  botella: "garrafa",
  garbanzos: "grao",
  girasol: "girassol",
  fresca: "fresco",
  pequena: "pequeno",
  molido: "moido",
  grano: "grao",
  descafeinado: "descafeinado",
  descafeinada: "descafeinado",
};

const PRIVATE_BRANDS = [
  "pingo doce biologico",
  "pingo doce",
  "continente equilibrio",
  "continente selecao",
  "cozinha continente",
  "continente",
  "auchan essencial",
  "auchan extra",
  "auchan",
  "hacendado",
  "bosque verde",
  "nossa padaria",
  "nossa fruta e legumes",
  "os nossos frescos",
  "da nossa pastelaria",
  "polegar",
  "mylabel",
  "go active",
  "aldi",
  "lidl",
  "minipreco",
];

/** Marcas nacionais frequentes, para as retirar do nome da Auchan (brand=null). */
const NATIONAL_BRANDS = [
  "nescafe dolce gusto",
  "oliveira da serra",
  "terra nossa",
  "terra nostra",
  "bom petisco",
  "bom sucesso",
  "branca de neve",
  "coca cola",
  "coca-cola",
  "super bock",
  "delta q",
  "delta",
  "mimosa",
  "cigala",
  "barilla",
  "milaneza",
  "nescafe",
  "alpro",
  "compal",
  "ramirez",
  "tenorio",
  "gallo",
  "fula",
  "luso",
  "vitalis",
  "primor",
  "vaqueiro",
  "planta",
  "becel",
  "matinal",
  "matinados",
  "gresso",
  "agros",
  "limiano",
  "milhafre",
  "sical",
  "buondi",
  "skip",
  "fairy",
  "renova",
  "sagres",
  "heineken",
  "amstel",
  "nestle",
  "danone",
  "activia",
  "oikos",
  "um bongo",
  "oriente",
  "caçarola",
  "cacarola",
  "royal",
  "maizena",
  "cristall",
  "cristal",
  "pedras",
  "frize",
  "yoggi",
  "nestum",
  "monchique",
  "riberalves",
  "aptamil",
  "actimel",
  "bimbo",
  "gullon",
  "vatel",
  "saborosa",
  "fastio",
  "penacova",
  "pedras salgadas",
  "cergal",
  "steinburg",
  "nivea",
  "colgate",
  "palmolive",
  "ariel",
  "persil",
  "vizir",
  "calgon",
  "cif",
  "ajax",
  "loreal",
  "l oreal",
];

const PRIVATE_BRANDS_SORTED = [...PRIVATE_BRANDS].sort((a, b) => b.length - a.length);
const NATIONAL_BRANDS_SORTED = [...NATIONAL_BRANDS].sort((a, b) => b.length - a.length);

const VARIETY_GROUPS: string[][] = [
  ["agulha", "carolino", "basmati", "vaporizado", "arborio", "integral"],
  ["meiogordo", "magro", "gordo"],
  ["esparguete", "penne", "fusilli", "espirais", "macarrao", "fusili"],
  ["natural", "azeite", "oleo"],
  ["semlactose"],
  ["classem", "classel", "classeml"],
  ["comsal", "semsal"],
  ["intenso", "classico", "ouro", "selecionado", "gold", "creme", "chavena", "superior"],
  ["moido", "grao", "soluvel"],
  ["ristretto", "lungo", "espresso"],
  ["zero", "original", "light", "diet"],
  ["descafeinado"],
  ["zero"],
  ["achocolatado"],
  [
    "morango",
    "banana",
    "ananas",
    "coco",
    "chocolate",
    "baunilha",
    "pessego",
    "limao",
    "framboesa",
    "mirtilo",
    "manga",
    "tutti",
    "frutti",
    "natural",
  ],
];

export function tokenize(name: string): string[] {
  return normalizeText(cleanOfferName(name))
    .split(/\s+/)
    .map((t) => t.replace(/^\d+(?:[.,]\d+)?/, ""))
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
 * Similaridade combinada: sobreposicao de tokens (ordem irrelevante) + Jaro-Winkler.
 * Marcas proprias e texto extra das lojas ja foram limpos nos tokens de identidade.
 */
export function nameSimilarity(a: string, b: string): number {
  const tokensA = identityTokens(a);
  const tokensB = identityTokens(b);
  const overlap = tokenOverlap(tokensA, tokensB);
  const dice = tokenDice(tokensA, tokensB);
  const keyA = canonicalKey(a);
  const keyB = canonicalKey(b);
  const jwScore = jaroWinkler(keyA, keyB);
  return 0.5 * overlap + 0.3 * dice + 0.2 * jwScore;
}

export function sameSize(
  a: ParsedQuantity | null,
  b: ParsedQuantity | null,
  tolerance = 0.02,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.baseUnit !== b.baseUnit) return false;
  const scale = Math.max(a.baseQuantity, b.baseQuantity, 0.01);
  return Math.abs(a.baseQuantity - b.baseQuantity) <= Math.max(tolerance, scale * 0.03);
}

export type MatchOutcome =
  | { status: "matched"; globalId: number; confidence: number }
  | { status: "review"; globalId: number; confidence: number }
  | { status: "orphan"; globalId: null; confidence: 0 };

export interface MatchThresholds {
  auto: number;
  review: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  auto: 0.78,
  review: 0.62,
};

export interface MatchCandidate extends ProductGlobal {
  parsedQuantity?: ParsedQuantity | null;
}

export interface ListingRef {
  name: string;
  brand?: string | null;
  ean?: string | null;
  url?: string | null;
  supermarketId?: number;
}

export function pairListings(
  a: ListingRef,
  b: ListingRef,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): { status: "matched" | "review" | "reject"; score: number; sameBrand: boolean } {
  if (a.supermarketId != null && b.supermarketId != null && a.supermarketId === b.supermarketId) {
    return { status: "reject", score: 0, sameBrand: false };
  }
  if (a.ean && b.ean && a.ean === b.ean) {
    return { status: "matched", score: 1, sameBrand: true };
  }

  const qtyA = parseQuantity(a.name);
  const qtyB = parseQuantity(b.name);
  if (!sizesCompatible(a.name, b.name, qtyA, qtyB)) {
    return { status: "reject", score: 0, sameBrand: false };
  }

  const brandA = resolveListingBrand(a.brand, a.name, a.url);
  const brandB = resolveListingBrand(b.brand, b.name, b.url);
  if (brandsConflict(brandA, brandB)) return { status: "reject", score: 0, sameBrand: false };

  const tokensA = identityTokens(a.name, brandA?.key ?? null);
  const tokensB = identityTokens(b.name, brandB?.key ?? null);
  if (varietiesConflict(tokensA, tokensB)) return { status: "reject", score: 0, sameBrand: false };

  const sameBrand = Boolean(brandA && brandB && brandA.key === brandB.key && !brandA.private);
  const commodity = !brandA && !brandB;
  const shared = tokensA.filter((t) => tokensB.includes(t)).length;
  if (!sameBrand && !commodity) return { status: "reject", score: 0, sameBrand: false };
  if (commodity && shared < 3) return { status: "reject", score: 0, sameBrand: false };

  const labeledA = `${brandA && !brandA.private ? brandA.key : ""} ${a.name}`;
  const labeledB = `${brandB && !brandB.private ? brandB.key : ""} ${b.name}`;
  const jaccard = tokenJaccard(identityTokens(labeledA), identityTokens(labeledB));
  const score = nameSimilarity(labeledA, labeledB);

  if (commodity) {
    if (score >= 0.85 && jaccard >= 0.7) return { status: "matched", score, sameBrand: false };
    return { status: "reject", score, sameBrand: false };
  }

  const autoCut = Math.min(thresholds.auto, 0.68);
  if (score >= autoCut && jaccard >= 0.5) return { status: "matched", score, sameBrand };
  if (score >= thresholds.review && jaccard >= 0.35) return { status: "review", score, sameBrand };
  return { status: "reject", score, sameBrand };
}

export function matchProduct(
  raw: Pick<RawProduct, "name" | "ean"> & { brand?: string | null; productUrl?: string | null },
  candidates: MatchCandidate[],
  findByEan?: (ean: string) => ProductGlobal | undefined,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): MatchOutcome {
  if (raw.ean) {
    const byEan = findByEan
      ? findByEan(raw.ean)
      : candidates.find((c) => c.eanCode === raw.ean);
    if (byEan) {
      return { status: "matched", globalId: byEan.id, confidence: 1 };
    }
  }

  let best: { id: number; score: number; status: "matched" | "review" } | null = null;
  const left: ListingRef = { name: raw.name, brand: raw.brand, ean: raw.ean, url: raw.productUrl };

  for (const candidate of candidates) {
    const decision = pairListings(
      left,
      { name: candidate.nameGlobal, brand: candidate.brand, ean: candidate.eanCode },
      thresholds,
    );
    if (decision.status === "reject") continue;
    if (!best || decision.score > best.score) {
      best = { id: candidate.id, score: decision.score, status: decision.status };
    }
  }

  if (!best) return { status: "orphan", globalId: null, confidence: 0 };
  return { status: best.status, globalId: best.id, confidence: best.score };
}

interface ResolvedBrand {
  key: string;
  private: boolean;
}

function foldForTokens(name: string): string {
  let text = normalizeText(cleanOfferName(name));
  text = text.replace(/aceite(?:\s+de)?\s+oliva/g, "azeite");
  text = text.replace(/aceite(?:\s+de)?\s+girasol/g, "oleo girassol");
  text = text.replace(/\baceite\b/g, "oleo");
  text = text.replace(/meio\s+gordo/g, "meiogordo");
  text = text.replace(/sem\s+lactose|0\s*lactose/g, "semlactose");
  text = text.replace(/achocolatad[oa]|\bcom chocolate\b/g, "achocolatado");
  text = text.replace(/sem\s+gas/g, "semgas");
  text = text.replace(/com\s+gas/g, "comgas");
  text = text.replace(/com\s+sal/g, "comsal");
  text = text.replace(/sem\s+sal/g, "semsal");
  text = text.replace(/classe\s*m\s*[\/e]\s*l\b/g, "classeml");
  text = text.replace(/classe\s*m\s+l\b/g, "classeml");
  text = text.replace(/classe\s*ml\b/g, "classeml");
  text = text.replace(/classe\s*m\b/g, "classem");
  text = text.replace(/classe\s*l\b/g, "classel");
  return text;
}

export function identityTokens(name: string, _brandKey?: string | null): string[] {
  const tokens = foldForTokens(name)
    .split(/\s+/)
    .map((t) => TOKEN_SYNONYMS[t] ?? t)
    .map((t) => t.replace(/^\d+(?:[.,]\d+)?/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !NOISE_TOKENS.has(t) && !/^\d+([.,]\d+)?$/.test(t));
  return [...new Set(tokens)].sort();
}

function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  return inter / Math.min(a.length, b.length);
}

function tokenDice(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  return (2 * inter) / (a.length + b.length);
}

function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  return inter / (a.length + b.length - inter);
}

function sizesCompatible(
  nameA: string,
  nameB: string,
  qtyA: ParsedQuantity | null,
  qtyB: ParsedQuantity | null,
): boolean {
  if (sameSize(qtyA, qtyB)) return true;
  const packA = parsePackCount(nameA);
  const packB = parsePackCount(nameB);
  return Boolean(packA && packB && packA === packB);
}

function lookupBrandKey(normalized: string): ResolvedBrand | null {
  const hay = ` ${normalized} `;
  for (const brand of NATIONAL_BRANDS_SORTED) {
    if (hay.includes(` ${brand} `) || normalized === brand) {
      return { key: brand, private: false };
    }
  }
  for (const brand of PRIVATE_BRANDS_SORTED) {
    if (hay.includes(` ${brand} `) || normalized === brand) {
      return { key: brand, private: true };
    }
  }
  return null;
}

export function resolveBrand(brand: string | null | undefined, name: string): ResolvedBrand | null {
  const fromField = brand?.trim() ? lookupBrandKey(normalizeText(brand)) : null;
  if (fromField) return fromField;
  if (brand?.trim()) {
    const key = normalizeText(brand);
    const isPrivate = PRIVATE_BRANDS_SORTED.some((p) => key === p || key.startsWith(`${p} `));
    return { key, private: isPrivate };
  }
  return lookupBrandKey(normalizeText(cleanOfferName(name)));
}

export function resolveListingBrand(
  brand?: string | null,
  name?: string,
  url?: string | null,
): ResolvedBrand | null {
  const fromField = brand?.trim() ? resolveBrand(brand, "") : null;
  const fromName = name ? resolveBrand(null, name) : null;
  const fromUrl = url ? resolveBrand(null, urlToWords(url)) : null;
  const options = [fromName, fromUrl, fromField].filter((b): b is ResolvedBrand => Boolean(b));
  return options.find((b) => !b.private) ?? options[0] ?? null;
}

function urlToWords(url: string): string {
  let pathname = url.split(/[?#]/)[0] ?? "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = pathname.replace(/^https?:\/\/[^/]+/i, "");
  }
  return safeDecode(pathname)
    .replace(/\.html?$/i, "")
    .replace(/[-_/]+/g, " ");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function brandsConflict(a: ResolvedBrand | null, b: ResolvedBrand | null): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return a.key !== b.key;
}

function varietiesConflict(a: string[], b: string[]): boolean {
  for (const group of VARIETY_GROUPS) {
    if (group.includes("azeite") || group.includes("oleo")) {
      const tuna = a.includes("atum") || b.includes("atum");
      if (!tuna) continue;
    }
    if (group.length === 1) {
      const token = group[0];
      if (a.includes(token) !== b.includes(token)) return true;
      continue;
    }
    const inA = group.filter((t) => a.includes(t));
    const inB = group.filter((t) => b.includes(t));
    if (inA.length && inB.length) {
      const same = inA.length === inB.length && inA.every((t) => inB.includes(t));
      if (!same) return true;
    }
  }
  return false;
}
