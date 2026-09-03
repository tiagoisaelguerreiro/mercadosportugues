import Link from "next/link";
import type { Supermarket } from "@/lib/types";
import { cn } from "@/lib/utils";

const FALLBACK = "#64748b";

/** Ponto colorido com a cor de marca do supermercado. */
export function SupermarketDot({
  supermarket,
  size = "md",
  className,
}: {
  supermarket: Pick<Supermarket, "colorHex" | "name">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full shadow-inner ring-1 ring-black/5 dark:ring-white/10",
        dims,
        className,
      )}
      style={{ backgroundColor: supermarket.colorHex ?? FALLBACK }}
    />
  );
}

/** Chip com ponto + nome; opcionalmente liga a pagina do supermercado. */
export function SupermarketChip({
  supermarket,
  href,
  active = false,
  className,
}: {
  supermarket: Pick<Supermarket, "colorHex" | "name" | "slug">;
  href?: string;
  active?: boolean;
  className?: string;
}) {
  const classes = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all",
    active
      ? "border-foreground bg-foreground text-background shadow-sm"
      : "border-border bg-card text-foreground/80 hover:border-brand-300 hover:text-foreground hover:shadow-soft dark:hover:border-brand-700",
    className,
  );
  const inner = (
    <>
      <SupermarketDot supermarket={supermarket} />
      {supermarket.name}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  return <span className={classes}>{inner}</span>;
}

/** Avatar circular com a inicial do supermercado (para listas e rankings). */
export function SupermarketAvatar({
  supermarket,
  className,
}: {
  supermarket: Pick<Supermarket, "colorHex" | "name">;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-inner",
        className,
      )}
      style={{ backgroundColor: supermarket.colorHex ?? FALLBACK }}
    >
      {supermarket.name.charAt(0)}
    </span>
  );
}
