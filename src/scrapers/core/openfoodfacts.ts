import { identityTokens, nameSimilarity, sameSize } from "@/lib/matching";
import { isValidEan, normalizeText, parseQuantity } from "@/lib/parsing";
import type { HttpClient } from "./http-client";

/**
 * Fallback de EANs via OpenFoodFacts (base de dados aberta de codigos de barras).
 *
 * Usado quando a loja nao expoe EAN (Pingo Doce, Mercadona): pesquisa por nome
 * e so aceita com criterios estritos (marca + tamanho + similaridade alta).
 * Nunca "forca" um match duvidoso — sem acordo forte, devolve null.
 *
 * Cortesia: User-Agent identificativo + delays do HttpClient (1 pedido de cada
 * vez, como no resto do pipeline).
 */
const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
}

export interface OffSearchResult {
  products?: OffProduct[];
}

/** Aceitacao estrita de um candidato OFF. Devolve o EAN ou null. */
export function acceptOffCandidate(
  candidate: OffProduct,
  name: string,
  brand: string | null,
): string | null {
  const ean = (candidate.code ?? "").replace(/\D/g, "");
  if (!isValidEan(ean)) return null;

  const candName = candidate.product_name ?? "";
  if (!candName) return null;

  // 1) Marca: se conhecemos a nossa, o OFF tem de a listar.
  if (brand) {
    const ours = new Set(normalizeText(brand).split(" ").filter((t) => t.length > 2));
    const theirs = normalizeText(candidate.brands ?? "");
    const overlap = [...ours].some((token) => theirs.includes(token));
    if (!overlap) return null;
  }

  // 2) Tamanho: veto apenas quando ambos conhecidos e diferentes. Se um dos
  // lados nao declara tamanho, a decisao fica para a similaridade do nome.
  const ourQty = parseQuantity(name);
  const theirQty = parseQuantity(`${candName} ${candidate.quantity ?? ""}`);
  if (ourQty && theirQty && !sameSize(ourQty, theirQty)) return null;

  // 3) Nome: similaridade alta. Sem marca conhecida, exige quase-identidade:
  // um nome generico ("Leite Meio Gordo") pode ser de qualquer marca.
  const threshold = brand ? 0.82 : 0.97;
  if (nameSimilarity(name, candName) < threshold) return null;

  return ean;
}

export async function searchOff(
  http: HttpClient,
  name: string,
  limit = 15,
): Promise<OffProduct[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("search_terms", name);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  // OpenFoodFacts pede identificacao; o HttpClient roda o UA mas aqui fixamos um descritivo.
  const data = await http.getJson<OffSearchResult>(url.toString());
  return data.products ?? [];
}

/** Pesquisa e devolve o primeiro EAN que passa o criterio estrito, ou null. */
export async function findEanViaOff(
  http: HttpClient,
  name: string,
  brand: string | null,
): Promise<string | null> {
  for (const query of buildOffQueries(name, brand)) {
    let products: OffProduct[];
    try {
      products = await searchOff(http, query);
    } catch {
      return null;
    }
    for (const candidate of products) {
      const accepted = acceptOffCandidate(candidate, name, brand);
      if (accepted) return accepted;
    }
  }
  return null;
}

/**
 * Queries por ordem de especificidade: primeiro nome completo (preciso),
 * depois marca + tokens significativos (recall — a pesquisa OFF faz AND dos
 * termos e nomes longos de loja devolvem zero resultados).
 */
export function buildOffQueries(name: string, brand: string | null): string[] {
  // Corta sufixos de rotulo ("Leite 1 L | 0,9 €/L" -> "Leite 1 L"): poluem a
  // pesquisa AND e nao ajudam a identificar o produto.
  const clean = name.split("|")[0].trim();
  const full = `${brand ?? ""} ${clean}`.trim().replace(/\s+/g, " ");
  const short = [...new Set([brand, ...identityTokens(clean)])]
    .filter((t): t is string => !!t)
    .join(" ");
  const queries = [full];
  if (short && short.toLowerCase() !== full.toLowerCase()) queries.push(short);
  return queries;
}
