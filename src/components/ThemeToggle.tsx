"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  // O tema resolvido só é conhecido no cliente; até lá usa um rótulo neutro
  // para o HTML do servidor coincidir com a primeira renderização do cliente.
  const label = mounted
    ? `Mudar para tema ${next === "dark" ? "escuro" : "claro"}`
    : "Alternar tema";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Sun className="h-[18px] w-[18px] transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
}
