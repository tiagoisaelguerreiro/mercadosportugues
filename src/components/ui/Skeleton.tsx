import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-muted", className)} aria-hidden />;
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[320px] flex-col space-y-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 rounded-2xl" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-7 w-1/2" />
            </div>
          </div>
          <div className="mt-auto space-y-2 border-t border-border/40 pt-4">
            <Skeleton className="h-4 w-full bg-muted/70" />
            <Skeleton className="h-4 w-5/6 bg-muted/50" />
            <Skeleton className="h-4 w-2/3 bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5" aria-hidden>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-xl bg-muted/70" />
        <Skeleton className="h-8 w-28 rounded-xl bg-muted/60" />
        <Skeleton className="h-8 w-24 rounded-xl bg-muted/50" />
      </div>
      <div className="flex gap-2 border-t border-border/60 pt-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28 bg-muted/70" />
        <Skeleton className="h-8 w-24 bg-muted/60" />
      </div>
    </div>
  );
}

export function CatalogSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div className="space-y-8">
      {withSearch && (
        <div className="rounded-4xl border border-border bg-card p-6 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-14 w-full rounded-2xl bg-muted/70" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 bg-muted/60" />
              <Skeleton className="h-6 w-16 bg-muted/60" />
              <Skeleton className="h-6 w-16 bg-muted/60" />
            </div>
          </div>
        </div>
      )}
      <FiltersSkeleton />
      <div className="flex items-end justify-between px-1">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3.5 w-40 bg-muted/60" />
        </div>
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>
      <ProductGridSkeleton />
    </div>
  );
}
