import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "promo" | "amber" | "muted" | "outline" | "dark" | "info";

const VARIANTS: Record<Variant, string> = {
  brand: "bg-brand-600 text-white shadow-sm shadow-brand-600/30",
  promo:
    "bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
  amber:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  muted: "bg-muted text-muted-foreground",
  outline: "border border-border bg-card text-foreground",
  dark: "bg-foreground text-background",
  info: "bg-sky-100 text-sky-800 ring-1 ring-sky-200/60 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
};

export function Badge({
  children,
  variant = "muted",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider leading-4",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
