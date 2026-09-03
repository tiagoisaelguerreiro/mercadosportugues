import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: string };
  as?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
}

/** Cabecalho de seccao consistente: eyebrow + titulo + descricao + acao opcional. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as = "h2",
  className,
  children,
}: Props) {
  const Tag = as;
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <Tag
          className={cn(
            "mt-1 font-display font-extrabold tracking-tight text-foreground text-balance",
            as === "h1" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[1.75rem]",
          )}
        >
          {title}
        </Tag>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
      {action && (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:border-brand-300 hover:text-brand-700 dark:hover:border-brand-700 dark:hover:text-brand-300"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
