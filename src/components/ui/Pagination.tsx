import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  totalPages: number;
  /** Constroi o href para uma pagina (mantem os restantes filtros). */
  hrefFor: (page: number) => string;
  className?: string;
}

/** Paginacao acessivel baseada em links (funciona sem JavaScript). */
export function Pagination({ page, totalPages, hrefFor, className }: Props) {
  if (totalPages <= 1) return null;

  const pages = visiblePages(page, totalPages);
  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border text-xs font-bold transition";

  return (
    <nav aria-label="Paginação" className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(btn, "border-border bg-card px-3 hover:bg-muted")} rel="prev">
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Anterior</span>
        </Link>
      ) : (
        <span className={cn(btn, "border-border/50 px-3 text-muted-foreground/40")}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              btn,
              "px-3 tabular",
              p === page
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(btn, "border-border bg-card px-3 hover:bg-muted")} rel="next">
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Seguinte</span>
        </Link>
      ) : (
        <span className={cn(btn, "border-border/50 px-3 text-muted-foreground/40")}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

function visiblePages(page: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => set.add(p));
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}
