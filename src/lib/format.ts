export function formatEuro(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatPricePerUnit(
  value: number | null | undefined,
  uom: string | null | undefined,
): string | null {
  if (value == null || !uom) return null;
  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} €/${uom}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value > 0 ? "-" : ""}${Math.abs(value).toFixed(0)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-PT").format(value);
}

/** Interpreta YYYY-MM-DD como data local (evita recuar um dia em UTC+). */
export function parseIsoDate(iso: string): Date {
  const day = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return new Date(iso);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** "02 set." — para eixos de graficos e listas compactas. */
export function formatDatePt(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(parseIsoDate(iso));
}

/** "2 de setembro de 2026" */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(
    parseIsoDate(iso),
  );
}

/** "02/09/2026, 06:15" */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Tempo relativo em portugues ("hoje", "ontem", "há 3 dias").
 * Trabalha com datas ISO (YYYY-MM-DD) ou timestamps completos.
 */
export function formatRelativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "sem dados";
  const target = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(target.getTime())) return "sem dados";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(target)) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "há 1 semana" : `há ${w} semanas`;
  }
  const m = Math.floor(days / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

/** Duracao em ms para texto curto ("850 ms", "12,4 s", "2 min 05 s"). */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")} s`;
  const min = Math.floor(s / 60);
  const rem = Math.round(s - min * 60);
  return `${min} min ${rem.toString().padStart(2, "0")} s`;
}
