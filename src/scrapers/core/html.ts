import type { BaseUnit } from "@/lib/types";
import { parsePrice, parseQuantity } from "@/lib/parsing";

/**
 * Utilitarios leves de extracao de HTML para os adapters (sem dependencias).
 * Os sites de retalho servem HTML parcial (SFCC/SFRA) — regex tolerantes sao
 * suficientes e evitam carregar um parser DOM completo no cron.
 */

const NAMED_ENTITIES: Record<string, string> = {
  quot: "\"",
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  euro: "€",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  ccedil: "ç",
  eacute: "é",
  ecirc: "ê",
  iacute: "í",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  uacute: "ú",
  Aacute: "Á",
  Agrave: "À",
  Acirc: "Â",
  Atilde: "Ã",
  Ccedil: "Ç",
  Eacute: "É",
  Ecirc: "Ê",
  Iacute: "Í",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Uacute: "Ú",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#x")) return String.fromCharCode(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCharCode(parseInt(key.slice(1), 10));
    return NAMED_ENTITIES[key] ?? entity;
  });
}

/** Remove tags, descodifica entidades e normaliza espacos. */
export function cleanHtmlText(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = decodeHtmlEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Le o valor de um atributo (primeira ocorrencia) num fragmento HTML. */
export function extractAttribute(html: string, attr: string): string | null {
  const re = new RegExp(`\\s${attr}=(["'])([\\s\\S]*?)\\1`, "i");
  return html.match(re)?.[2] ?? null;
}

/** Conteudo interno do primeiro elemento cuja classe contem `className`. */
export function extractClassBody(html: string, className: string): string | null {
  const re = new RegExp(
    `<[^>]*class=(["'])[^"']*${escapeRegex(className)}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i",
  );
  return html.match(re)?.[2] ?? null;
}

/** Tag de abertura completa do primeiro elemento cuja classe contem `className`. */
export function extractOpeningTag(html: string, className: string): string | null {
  const re = new RegExp(`<[^>]*class=(["'])[^"']*${escapeRegex(className)}[^"']*\\1[^>]*>`, "i");
  return html.match(re)?.[0] ?? null;
}

/**
 * Le um preco de microdata SFCC (Continente, Pingo Doce, Auchan).
 *
 * Formas reais encontradas:
 *   - `<span class="strike-through value" content="1.64">` (content na propria tag)
 *   - `<span class="sales ...">...<span class="value" content="0.59">` (content em span aninhado)
 *
 * Procura o atributo `content` (maquina, ex.: "1.79") em vez do texto visivel
 * ("1,79 €"), evitando o problema de spans aninhados (`.sr-only`) que partem a
 * extracao por texto. Devolve `null` se nao encontrar.
 */
export function extractMicrodataPrice(html: string, markerClass: string): number | null {
  const wanted = markerClass.toLowerCase();
  // Encontra a tag cujo atributo class contem o token exato (case-insensitive).
  const tagRe = /<[^>]*class=(["'])([^"']*)\1[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  let markerIndex = -1;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    const tokens = tagMatch[2].split(/\s+/).map((t) => t.toLowerCase());
    if (tokens.includes(wanted)) {
      markerIndex = tagMatch.index;
      break;
    }
  }
  if (markerIndex < 0) return null;

  // Janela a partir do marcador: apanha content na propria tag ou em span aninhado.
  const window = html.slice(markerIndex, markerIndex + 2000);
  const withClassFirst =
    /<[^>]*class=(["'])[^"']*\bvalue\b[^"']*\1[^>]*content=(["'])([^"']+)\2/i.exec(window);
  const withContentFirst =
    /<[^>]*content=(["'])([^"']+)\1[^>]*class=(["'])[^"']*\bvalue\b[^"']*\3/i.exec(window);
  const raw = withClassFirst?.[3] ?? withContentFirst?.[2] ?? null;
  return parsePrice(raw);
}

/**
 * Interpreta rotulos de preco por unidade do tipo "1 Kg | 0,59 €/Kg"
 * (Pingo Doce `.product-unit`, Auchan `.auc-measures--price-per-unit`).
 * Exige a parte com "/" (preco por unidade real); um rotulo so com quantidade
 * (ex.: "1 Kg") devolve `null` para o fallback calcular a partir do nome.
 */
export function parseUnitPriceLabel(
  text: string | null | undefined,
): { value: number; uom: BaseUnit } | null {
  if (!text) return null;
  const parts = text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const perPart = parts.find((p) => p.includes("/"));
  if (!perPart) return null;
  const value = parsePrice(perPart);
  const uom = normalizeUom(perPart);
  if (value == null || uom == null) return null;
  return { value, uom };
}

export function parseJsonAttribute<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeHtmlEntities(value)) as T;
  } catch {
    return null;
  }
}

export function cleanEan(ean: string | undefined | null): string | null {
  if (!ean) return null;
  const digits = ean.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function normalizeUom(uom: string | undefined | null): BaseUnit | null {
  if (!uom) return null;
  const u = uom.toLowerCase();
  if (u.includes("kg")) return "kg";
  if (/(^|[^a-z])(l|lt|litro)([^a-z]|$)/.test(u)) return "L";
  return null;
}

export function absoluteUrl(base: string, url: string): string {
  if (url.startsWith("http")) return url;
  return base + (url.startsWith("/") ? url : `/${url}`);
}

/** Pede uma variante maior das imagens Demandware (`sw`/`sh` de thumbnail). */
export function upgradeImageUrl(url: string | null | undefined, size = 400): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("sw")) parsed.searchParams.set("sw", String(size));
    if (parsed.searchParams.has("sh")) parsed.searchParams.set("sh", String(size));
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Junta o texto de quantidade ao nome quando este ainda nao a contem. */
export function withQuantityLabel(name: string, quantityText: string | undefined | null): string {
  if (!quantityText || parseQuantity(name)) return name;
  const cleanQuantity = quantityText
    .replace(/^emb\.\s*/i, "")
    .replace(/^quant\.\s*m[ií]nima\s*=\s*/i, "")
    .trim();
  return cleanQuantity ? `${name} ${cleanQuantity}` : name;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
