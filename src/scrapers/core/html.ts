import type { BaseUnit } from "@/lib/types";
import { parseQuantity } from "@/lib/parsing";

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
