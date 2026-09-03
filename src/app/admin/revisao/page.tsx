import type { Metadata } from "next";
import { ReviewMatchesPanel } from "./ReviewMatchesPanel";

export const metadata: Metadata = { title: "Revisão de matches" };

export default function AdminReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Revisão de matches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produtos extraídos dos supermercados cuja correspondência automática ficou com confiança baixa. Aprova a sugestão,
          associa manualmente a um produto global ou cria um novo.
        </p>
      </div>
      <ReviewMatchesPanel />
    </div>
  );
}
