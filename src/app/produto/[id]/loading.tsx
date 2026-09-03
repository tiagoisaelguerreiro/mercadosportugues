import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-12" aria-busy>
      <Skeleton className="h-3.5 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.7fr)]">
        <div className="rounded-4xl border border-border bg-card p-6">
          <Skeleton className="mx-auto h-64 w-64 rounded-3xl" />
          <div className="mt-5 space-y-2">
            <Skeleton className="h-3 w-full bg-muted/60" />
            <Skeleton className="h-3 w-5/6 bg-muted/60" />
            <Skeleton className="h-3 w-2/3 bg-muted/60" />
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-4 w-1/2 bg-muted/60" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl bg-muted/70" />
            <Skeleton className="h-32 rounded-3xl bg-muted/60" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
      <Skeleton className="h-[520px] rounded-4xl" />
    </div>
  );
}
