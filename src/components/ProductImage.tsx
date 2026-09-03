"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Kind =
  | "milk"
  | "rice"
  | "soda"
  | "oil"
  | "butter"
  | "pasta"
  | "eggs"
  | "detergent"
  | "water"
  | "yogurt"
  | "coffee"
  | "beer"
  | "generic";

function isRemotePhoto(url: string | null | undefined): url is string {
  if (!url) return false;
  return !/placehold\.co|via\.placeholder|placeholder\.com|picsum\.photos/i.test(url);
}

export function productKindFromName(name: string, brand?: string | null): Kind {
  const t = `${brand ?? ""} ${name}`.toLowerCase();
  if (/leite|milk/.test(t)) return "milk";
  if (/arroz/.test(t)) return "rice";
  if (/coca|cola|refrigerante/.test(t)) return "soda";
  if (/azeite/.test(t)) return "oil";
  if (/manteiga/.test(t)) return "butter";
  if (/esparguete|spaghetti|massa /.test(t)) return "pasta";
  if (/\bovos?\b/.test(t)) return "eggs";
  if (/detergente|skip|roupa l[ií]quid/.test(t)) return "detergent";
  if (/água|agua|\bluso\b/.test(t)) return "water";
  if (/iogurte/.test(t)) return "yogurt";
  if (/café|cafe|\bdelta\b/.test(t)) return "coffee";
  if (/cerveja|super bock/.test(t)) return "beer";
  return "generic";
}

interface Props {
  src?: string | null;
  alt: string;
  name?: string | null;
  brand?: string | null;
  className?: string;
  imgClassName?: string;
}

/**
 * Foto do produto quando a URL e real (scraper); caso contrario um packshot
 * ilustrado para o catalogo demo nao ficar com placeholders cinzentos.
 */
export function ProductImage({ src, alt, name, brand, className, imgClassName }: Props) {
  const usable = isRemotePhoto(src);
  const [broken, setBroken] = useState(false);
  const showPhoto = usable && !broken;
  const kind = productKindFromName(name ?? alt, brand);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-white dark:bg-white/5",
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-contain", imgClassName)}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <Packshot kind={kind} label={brand || name || alt} />
      )}
    </span>
  );
}

function Packshot({ kind, label }: { kind: Kind; label: string }) {
  const title = label.slice(0, 18);
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-hidden>
      <rect width="160" height="160" rx="28" fill={BG[kind]} />
      {KIND_DRAW[kind](title)}
    </svg>
  );
}

const BG: Record<Kind, string> = {
  milk: "#e8f3ff",
  rice: "#f4ead6",
  soda: "#ffe4e6",
  oil: "#ecfccb",
  butter: "#fef9c3",
  pasta: "#ffedd5",
  eggs: "#fef3c7",
  detergent: "#e0f2fe",
  water: "#e0f2fe",
  yogurt: "#fae8ff",
  coffee: "#efebe9",
  beer: "#fef3c7",
  generic: "#ecfdf5",
};

const KIND_DRAW: Record<Kind, (label: string) => ReactNode> = {
  milk: () => (
    <>
      <rect x="48" y="28" width="64" height="104" rx="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      <path d="M48 44h64l-8-16H56z" fill="#2563eb" />
      <rect x="58" y="62" width="44" height="36" rx="6" fill="#3b82f6" />
      <text x="80" y="84" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">1L</text>
    </>
  ),
  rice: () => (
    <>
      <path d="M44 48h72l-8 84H52z" fill="#f59e0b" />
      <rect x="52" y="64" width="56" height="28" rx="4" fill="#fff7ed" />
      <circle cx="68" cy="108" r="3" fill="#fde68a" />
      <circle cx="80" cy="114" r="2.5" fill="#fde68a" />
      <circle cx="92" cy="110" r="3" fill="#fde68a" />
    </>
  ),
  soda: () => (
    <>
      <rect x="62" y="22" width="36" height="116" rx="12" fill="#be123c" />
      <rect x="66" y="30" width="28" height="18" rx="4" fill="#fff" />
      <ellipse cx="80" cy="78" rx="10" ry="14" fill="#fff" opacity="0.25" />
    </>
  ),
  oil: () => (
    <>
      <path d="M78 22c8 0 14 8 14 16v10h-28V38c0-8 6-16 14-16z" fill="#365314" />
      <rect x="58" y="48" width="44" height="88" rx="16" fill="#65a30d" />
      <rect x="70" y="62" width="20" height="36" rx="4" fill="#ecfccb" />
    </>
  ),
  butter: () => (
    <>
      <rect x="36" y="52" width="88" height="56" rx="8" fill="#facc15" />
      <rect x="44" y="60" width="72" height="28" rx="4" fill="#fef9c3" />
      <rect x="52" y="96" width="56" height="6" rx="2" fill="#ca8a04" />
    </>
  ),
  pasta: () => (
    <>
      <rect x="50" y="30" width="60" height="100" rx="6" fill="#fb923c" />
      <rect x="58" y="48" width="44" height="54" rx="4" fill="#ffedd5" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={64 + i * 8} y="56" width="4" height="38" rx="2" fill="#c2410c" />
      ))}
    </>
  ),
  eggs: () => (
    <>
      <ellipse cx="62" cy="88" rx="18" ry="24" fill="#fefce8" stroke="#eab308" strokeWidth="2" />
      <ellipse cx="98" cy="84" rx="16" ry="22" fill="#fefce8" stroke="#eab308" strokeWidth="2" />
      <ellipse cx="80" cy="108" rx="17" ry="20" fill="#fffbeb" stroke="#ca8a04" strokeWidth="2" />
    </>
  ),
  detergent: () => (
    <>
      <path d="M70 24h20l8 18H62z" fill="#0369a1" />
      <rect x="58" y="42" width="44" height="96" rx="10" fill="#0284c7" />
      <rect x="68" y="62" width="24" height="24" rx="4" fill="#e0f2fe" />
    </>
  ),
  water: () => (
    <>
      <rect x="64" y="20" width="32" height="16" rx="4" fill="#0369a1" />
      <path d="M58 36h44l-6 104H64z" fill="#38bdf8" />
      <path d="M70 70c8 12 20 12 28 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  yogurt: () => (
    <>
      <rect x="50" y="44" width="60" height="80" rx="12" fill="#f5d0fe" />
      <ellipse cx="80" cy="44" rx="30" ry="12" fill="#e879f9" />
      <rect x="62" y="70" width="36" height="22" rx="4" fill="#fff" />
    </>
  ),
  coffee: () => (
    <>
      <rect x="48" y="36" width="64" height="92" rx="8" fill="#44403c" />
      <rect x="56" y="52" width="48" height="40" rx="4" fill="#a16207" />
      <circle cx="80" cy="72" r="10" fill="#fef3c7" />
    </>
  ),
  beer: () => (
    <>
      <rect x="68" y="18" width="24" height="20" rx="3" fill="#365314" />
      <path d="M58 38h44l-6 104H64z" fill="#ca8a04" />
      <rect x="64" y="52" width="32" height="28" rx="4" fill="#fef9c3" />
    </>
  ),
  generic: (label) => (
    <>
      <rect x="44" y="40" width="72" height="80" rx="12" fill="#10b981" />
      <text x="80" y="86" textAnchor="middle" fill="#ecfdf5" fontSize="10" fontWeight="700">
        {label.slice(0, 10)}
      </text>
    </>
  ),
};
