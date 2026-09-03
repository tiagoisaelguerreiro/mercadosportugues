import { CatalogSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-3.5 w-56" />
      <div className="flex items-center gap-5 rounded-4xl border border-border bg-card p-8">
        <Skeleton className="h-16 w-16 rounded-3xl" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-3.5 w-80 bg-muted/60" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <CatalogSkeleton />
    </div>
  );
}
