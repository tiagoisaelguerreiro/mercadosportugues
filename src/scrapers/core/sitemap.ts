/**
 * Leitura de sitemaps XML publicos (categorias) sem dependencias.
 * Usado para descobrir todas as paginas de categoria em vez de uma lista
 * hardcoded da primeira pagina de cada departamento.
 */

export function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

/** URLs que nao sao prefixo de outra (categorias folha). */
export function leafUrls(urls: string[]): string[] {
  const normalized = [...new Set(urls.map((url) => url.replace(/\/+$/, "")))].sort();
  return normalized.filter((url) => !normalized.some((other) => other !== url && other.startsWith(`${url}/`)));
}

export function locToPath(loc: string): string {
  const url = new URL(loc);
  return `${url.pathname}${url.search}`;
}

export function pathMatchesPrefixes(pathname: string, prefixes: string[]): boolean {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return prefixes.some((prefix) => {
    const needle = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return path === needle || path.startsWith(needle);
  });
}

export function limitCategories(paths: string[], max = Number(process.env.SCRAPER_MAX_CATEGORIES ?? 0)): string[] {
  if (Number.isFinite(max) && max > 0) return paths.slice(0, max);
  return paths;
}

export interface LeafPathOptions {
  /** So paths que comecam por um destes prefixos (ex.: `/mercearia/`). */
  pathPrefixes?: string[];
  /** Ignora URLs com query (`?cgid=`, pesquisa, etc.). */
  skipQuery?: boolean;
}

/** Categorias-folha de um urlset, ja convertidas em path do site. */
export function discoverLeafCategoryPaths(xml: string, options: LeafPathOptions = {}): string[] {
  const locs = parseSitemapLocs(xml).filter((loc) => {
    let url: URL;
    try {
      url = new URL(loc);
    } catch {
      return false;
    }
    if (options.skipQuery && url.search) return false;
    if (url.searchParams.has("cgid")) return false;
    if (url.pathname.toLowerCase().includes("/pesquisa")) return false;
    if (options.pathPrefixes?.length && !pathMatchesPrefixes(url.pathname, options.pathPrefixes)) {
      return false;
    }
    return true;
  });
  return leafUrls(locs)
    .map(locToPath)
    .map((path) => (path.endsWith("/") ? path : `${path}/`))
    .sort((a, b) => a.localeCompare(b));
}
