"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** URL a partilhar; por omissao a pagina atual. */
  url?: string;
  label?: string;
  className?: string;
}

export function ShareButton({ title, url, label = "Partilhar", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof window === "undefined") return;
    const target = url ? new URL(url, window.location.origin).toString() : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url: target });
        return;
      } catch {
        // utilizador cancelou ou partilha indisponivel: cai para copia
      }
    }

    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bloqueado — sem feedback
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
          <span className="text-brand-600 dark:text-brand-400">Link copiado!</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
