"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  initialQuery?: string;
  /** Caminho para onde a pesquisa navega (por omissao /pesquisa). */
  basePath?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ initialQuery = "", basePath = "/pesquisa", size = "lg", autoFocus = false, className }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform ?? ""));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    startTransition(() => router.push(q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath));
  }

  const large = size === "lg";

  return (
    <form onSubmit={submit} role="search" className={cn("group relative w-full", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        ) : (
          <Search className="h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-brand-500" />
        )}
      </div>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Procura um produto (ex.: leite, azeite, arroz)…"
        aria-label="Procurar produto"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        className={cn(
          "w-full rounded-2xl border border-border bg-card/90 pl-12 text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20",
          large ? "h-14 pr-36 text-base font-medium" : "h-11 pr-28 text-sm",
        )}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {large && (
          <kbd className="hidden h-6 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-semibold text-muted-foreground sm:inline-flex">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        )}
        <button
          type="submit"
          className={cn(
            "rounded-xl bg-brand-600 font-bold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/30",
            large ? "h-9 px-4 text-sm" : "h-8 px-3 text-xs",
          )}
        >
          Procurar
        </button>
      </div>
    </form>
  );
}
