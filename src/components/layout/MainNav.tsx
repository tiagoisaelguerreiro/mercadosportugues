"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_ITEMS } from "./nav-items";

/** Navegacao desktop com estado ativo baseado no pathname. */
export function MainNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.filter((i) => i.primary).map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-brand-600/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
                : "text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
