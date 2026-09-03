import {
  Apple,
  Baby,
  Bath,
  Beef,
  Croissant,
  CupSoda,
  Fish,
  Milk,
  PawPrint,
  Snowflake,
  SprayCan,
  Tag,
  Wheat,
  type LucideIcon,
} from "lucide-react";

const RULES: Array<[RegExp, LucideIcon]> = [
  [/mercearia|arroz|massa|cereal|despensa/, Wheat],
  [/lactic|latic|leite|ovo|queijo|iogurte/, Milk],
  [/bebida|agua|água|vinho|cerveja|sumo|refrig/, CupSoda],
  [/limpeza|lar|casa/, SprayCan],
  [/higiene|beleza|cuidado|banho/, Bath],
  [/congelad|gelado/, Snowflake],
  [/fruta|legume|hortic|vegeta/, Apple],
  [/carne|talho|charcut/, Beef],
  [/peixe|marisco|peixaria/, Fish],
  [/padaria|pastelaria|pao|pão|bolacha/, Croissant],
  [/beb[eé]|infantil|crianca|criança/, Baby],
  [/animal|pet|cao|cão|gato/, PawPrint],
];

/** Icone ilustrativo para uma categoria, escolhido por palavras-chave do slug/nome. */
export function categoryIcon(input: { slug: string; name: string }): LucideIcon {
  const key = `${input.slug} ${input.name}`.toLowerCase();
  for (const [re, icon] of RULES) if (re.test(key)) return icon;
  return Tag;
}

export function CategoryIcon({
  category,
  className,
}: {
  category: { slug: string; name: string };
  className?: string;
}) {
  const Icon = categoryIcon(category);
  return <Icon className={className} aria-hidden />;
}
