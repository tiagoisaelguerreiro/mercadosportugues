export interface NavItem {
  href: string;
  label: string;
  /** Mostrar na barra de navegacao desktop (os restantes so no menu mobile/footer). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/pesquisa", label: "Catálogo", primary: true },
  { href: "/promocoes", label: "Promoções", primary: true },
  { href: "/supermercados", label: "Supermercados", primary: true },
  { href: "/categorias", label: "Categorias", primary: true },
  { href: "/carrinho", label: "Carrinho" },
  { href: "/sobre", label: "Como funciona" },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/pesquisa") return pathname.startsWith("/pesquisa") || pathname.startsWith("/produto");
  if (href === "/categorias") return pathname.startsWith("/categoria");
  if (href === "/supermercados") return pathname.startsWith("/supermercado");
  return pathname === href || pathname.startsWith(`${href}/`);
}
