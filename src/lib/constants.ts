export const SITE_NAME = "MercadosPortugues";

export const POPULAR_TERMS = ["Leite", "Azeite", "Café", "Arroz", "Cerveja", "Iogurte", "Ovos", "Detergente"];

/** Periodos disponiveis no historico de precos (dias). */
export const HISTORY_PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
] as const;
