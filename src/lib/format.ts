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

export function formatDatePt(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  );
}
