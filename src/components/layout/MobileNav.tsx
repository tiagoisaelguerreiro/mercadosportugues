"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBasket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  // Fechar ao navegar.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquear scroll do body com o menu aberto e fechar com Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/80 shadow-sm transition-colors hover:bg-muted"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="relative mx-3 mt-2 rounded-3xl border border-border bg-card p-3 shadow-lift animate-fade-up"
          >
            <ul className="grid gap-1">
              <li>
                <Link
                  href="/"
                  aria-current={pathname === "/" ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition-colors",
                    pathname === "/"
                      ? "bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Sparkles className="h-4 w-4 opacity-70" />
                  Início
                </Link>
              </li>
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition-colors",
                        active
                          ? "bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {item.href === "/carrinho" ? <ShoppingBasket className="h-4 w-4 opacity-70" /> : <span className="h-4 w-4" />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-border px-4 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
