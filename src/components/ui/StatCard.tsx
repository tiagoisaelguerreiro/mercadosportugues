import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "brand" | "amber" | "dark";
  className?: string;
}

const TONES: Record<NonNullable<Props["tone"]>, { card: string; label: string; value: string; hint: string }> = {
  default: {
    card: "border-border bg-card",
    label: "text-muted-foreground",
    value: "text-foreground",
    hint: "text-muted-foreground",
  },
  brand: {
    card: "border-brand-200 bg-brand-50/80 dark:border-brand-900/50 dark:bg-brand-950/30",
    label: "text-brand-700 dark:text-brand-400",
    value: "text-brand-800 dark:text-brand-300",
    hint: "text-brand-700/80 dark:text-brand-400/80",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20",
    label: "text-amber-700 dark:text-amber-400",
    value: "text-amber-800 dark:text-amber-300",
    hint: "text-amber-700/80 dark:text-amber-400/80",
  },
  dark: {
    card: "border-slate-800 bg-slate-950 text-white dark:border-border dark:bg-card",
    label: "text-slate-400",
    value: "text-white",
    hint: "text-slate-400",
  },
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: Props) {
  const t = TONES[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border p-5 shadow-soft", t.card, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[11px] font-black uppercase tracking-[0.16em]", t.label)}>{label}</p>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0 opacity-70", t.label)} />}
      </div>
      <p className={cn("mt-3 font-display text-3xl font-extrabold tracking-tight tabular", t.value)}>{value}</p>
      {hint && <p className={cn("mt-1.5 text-xs font-medium leading-snug", t.hint)}>{hint}</p>}
    </div>
  );
}
