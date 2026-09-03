import { CatalogSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-3.5 w-48" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-3xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-56" />
        </div>
      </div>
      <CatalogSkeleton />
    </div>
  );
}
