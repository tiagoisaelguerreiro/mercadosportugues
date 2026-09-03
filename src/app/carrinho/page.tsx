import type { Metadata } from "next";
import { Suspense } from "react";
import { BasketView } from "./BasketView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Comparador de carrinho",
  description:
    "Junta os produtos que compras habitualmente e descobre em que supermercado o carrinho completo fica mais barato.",
  alternates: { canonical: "/carrinho" },
  robots: { index: true, follow: true },
};

export default function BasketPage() {
  return (
    <Suspense fallback={<BasketFallback />}>
      <BasketView />
    </Suspense>
  );
}

function BasketFallback() {
  return (
    <div className="space-y-8" aria-busy>
      <div className="rounded-4xl border border-border bg-card p-8">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-3 h-10 w-72" />
        <Skeleton className="mt-2 h-3.5 w-96 bg-muted/60" />
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-4xl lg:col-span-5" />
      </div>
    </div>
  );
}
