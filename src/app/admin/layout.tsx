import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · MercadosPortugues" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card px-5 py-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Painel de controlo</p>
            <p className="text-sm font-bold text-foreground">Administração</p>
          </div>
        </div>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
