import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-4xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="mt-5 font-display text-xl font-extrabold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
