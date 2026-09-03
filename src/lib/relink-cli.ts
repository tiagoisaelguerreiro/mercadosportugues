/**
 * Religa o catalogo local sem voltar a contactar os sites.
 *   tsx src/lib/relink-catalog.ts
 */
import { loadLiveCatalog, saveLiveCatalog } from "@/db/live-catalog";
import { relinkCatalog } from "@/lib/relink-catalog";

const catalog = loadLiveCatalog();
if (!catalog) {
  console.error("Sem catalogo em data/snapshots/live-catalog.json");
  process.exit(1);
}

const before = catalog.productsGlobal.length;
const linkedBefore = catalog.productsMarket.filter((m) => {
  const n = catalog.productsMarket.filter((x) => x.productGlobalId === m.productGlobalId).length;
  return n > 1;
}).length;

const next = relinkCatalog(catalog);
saveLiveCatalog(next);

const multi = new Map<number, number>();
for (const m of next.productsMarket) {
  const id = m.productGlobalId;
  if (id == null) continue;
  multi.set(id, (multi.get(id) ?? 0) + 1);
}
const compared = [...multi.values()].filter((n) => n > 1).length;
const offersOnCompared = [...multi.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0);

console.log(
  `Relink: ${before} → ${next.productsGlobal.length} produtos globais. ` +
    `${compared} produtos com preco em 2+ supermercados (${offersOnCompared} ofertas).`,
);
void linkedBefore;
