import { cleanOfferName, normalizeText, parsePackCount, parseQuantity } from "@/lib/parsing";
import { identityTokens, pairListings, resolveListingBrand, type ListingRef } from "@/lib/matching";
import { guessCategoryId, type LiveCatalog } from "@/db/live-catalog";
import type { ProductGlobal, ProductMarket } from "@/lib/types";

interface IndexedListing extends ListingRef {
  index: number;
  market: ProductMarket;
}

/**
 * Agrupa ofertas de supermercados diferentes no mesmo produto global.
 * Usa union-find (todas as pares de uma vez) em vez de matching guloso
 * pela ordem da recolha — assim A=B e B=C implicam A=C.
 */
export function relinkCatalog(catalog: LiveCatalog): LiveCatalog {
  const listings: IndexedListing[] = catalog.productsMarket.map((market, index) => ({
    index,
    market,
    name: market.nameMarket,
    brand: market.brandMarket ?? null,
    ean: market.rawEan,
    url: market.productUrl,
    supermarketId: market.supermarketId,
  }));

  const n = listings.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const stores: Set<number>[] = listings.map((l) => new Set([l.supermarketId ?? -1]));
  /** Ofertas com decisao manual do admin: o automatico nao as mexe. */
  const locked = new Set(
    listings.filter((l) => l.market.matchLocked).map((l) => l.index),
  );

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const storeOverlap = (a: number, b: number): boolean => {
    const sa = stores[find(a)];
    const sb = stores[find(b)];
    for (const s of sa) if (sb.has(s)) return true;
    return false;
  };

  const union = (i: number, j: number, force = false): void => {
    const a = find(i);
    const b = find(j);
    if (a === b) return;
    // Decisoes manuais nao sao desfeitas nem refeitas pelo automatico.
    if (!force && (locked.has(i) || locked.has(j))) return;
    if (!force && storeOverlap(i, j)) return;
    parent[a] = b;
    for (const s of stores[a]) stores[b].add(s);
  };

  // Pares manuais para o mesmo global ficam juntos (mesmo com mesma loja).
  const lockedByGlobal = new Map<number, number[]>();
  for (const listing of listings) {
    const gid = listing.market.productGlobalId;
    if (!locked.has(listing.index) || gid == null) continue;
    const list = lockedByGlobal.get(gid) ?? [];
    list.push(listing.index);
    lockedByGlobal.set(gid, list);
  }
  for (const idxs of lockedByGlobal.values()) {
    for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k], true);
  }

  const byEan = new Map<string, number[]>();
  for (const listing of listings) {
    if (!listing.ean) continue;
    const list = byEan.get(listing.ean) ?? [];
    list.push(listing.index);
    byEan.set(listing.ean, list);
  }
  for (const idxs of byEan.values()) {
    for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k]);
  }

  const buckets = new Map<string, number[]>();
  for (const listing of listings) {
    for (const key of listingBlocks(listing)) {
      const bucket = buckets.get(key) ?? [];
      bucket.push(listing.index);
      buckets.set(key, bucket);
    }
  }

  for (const idxs of buckets.values()) {
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a];
        const j = idxs[b];
        if (find(i) === find(j)) continue;
        if (listings[i].supermarketId === listings[j].supermarketId) continue;
        if (storeOverlap(i, j)) continue;
        const decision = pairListings(listings[i], listings[j]);
        if (decision.status === "matched") union(i, j);
      }
    }
  }

  const groups = new Map<number, IndexedListing[]>();
  for (const listing of listings) {
    const root = find(listing.index);
    const list = groups.get(root) ?? [];
    list.push(listing);
    groups.set(root, list);
  }

  const usedIds = new Set<number>();
  const globals: ProductGlobal[] = [];
  const markets: ProductMarket[] = [];

  // Grupos com decisao manual primeiro: reservam os seus IDs para os
  // automaticos nao os reutilizarem noutro produto.
  const groupList = [...groups.values()];
  groupList.sort((a, b) => {
    const aLocked = a.some((m) => locked.has(m.index)) ? 0 : 1;
    const bLocked = b.some((m) => locked.has(m.index)) ? 0 : 1;
    return aLocked - bLocked;
  });

  for (const members of groupList) {
    const lockedOnes = members.filter((m) => locked.has(m.index));
    if (lockedOnes.length > 0) {
      const keeper = lockedOnes.find((m) => m.market.productGlobalId != null);
      if (!keeper || keeper.market.productGlobalId == null) {
        // Rejeitado pelo admin: sem global, fica orfao bloqueado.
        for (const m of members) {
          markets.push({
            ...m.market,
            productGlobalId: null,
            matchStatus: "orphan",
            matchConfidence: null,
            matchLocked: true,
          });
        }
        continue;
      }
      let globalId = keeper.market.productGlobalId;
      if (usedIds.has(globalId)) globalId = nextFreeId(usedIds, members);
      usedIds.add(globalId);
      // Reutiliza a entidade global anterior quando existir.
      const prev = catalog.productsGlobal.find((g) => g.id === keeper.market.productGlobalId);
      if (prev && prev.id === globalId) {
        globals.push(prev);
      } else {
        const built = buildGlobal(members, usedIds);
        globals.push({ ...built, id: globalId });
      }
      for (const m of members) {
        markets.push({ ...m.market, productGlobalId: globalId, matchLocked: true });
      }
      continue;
    }
    const global = buildGlobal(members, usedIds);
    usedIds.add(global.id);
    globals.push(global);
    for (const member of members) {
      const linked = members.length > 1;
      // Fila de revisao sobrevive ao relink: singletons ex-review nao viram orphan.
      const wasReview = !linked && member.market.matchStatus === "review";
      markets.push({
        ...member.market,
        productGlobalId: global.id,
        matchStatus: linked ? "matched" : wasReview ? "review" : "orphan",
        matchConfidence: linked ? 0.9 : wasReview ? (member.market.matchConfidence ?? 0.8) : 0,
      });
    }
  }

  globals.sort((a, b) => a.id - b.id);
  return {
    ...catalog,
    productsGlobal: globals,
    productsMarket: markets,
    scrapedAt: new Date().toISOString(),
  };
}

function buildGlobal(members: IndexedListing[], usedIds: Set<number>): ProductGlobal {
  const voted = mode(
    members.map((m) => m.market.productGlobalId).filter((id): id is number => id != null && !usedIds.has(id)),
  );
  const id = voted ?? nextFreeId(usedIds, members);

  const ranked = [...members].sort((a, b) => scoreListing(b) - scoreListing(a));
  const best = ranked[0];
  const resolved = resolveListingBrand(best.brand, best.name, best.url);
  const q = parseQuantity(best.name);
  const image = members.map((m) => m.market.imageUrl).find((u) => u && !/placehold/.test(u)) ?? best.market.imageUrl;

  return {
    id,
    nameGlobal: cleanOfferName(best.name),
    brand: titleBrand(resolved?.key ?? best.brand),
    eanCode: members.map((m) => m.ean).find((e) => e) ?? null,
    categoryId: guessCategoryId(null, best.name),
    imageUrl: image ?? null,
    quantityValue: q?.value ?? null,
    quantityUnit: q?.unit ?? null,
    baseUnit: q?.baseUnit ?? null,
    baseQuantity: q?.baseQuantity ?? null,
  };
}

function listingBlocks(listing: IndexedListing): string[] {
  const keys = new Set<string>();
  const pack = parsePackCount(listing.name);
  const qty = parseQuantity(listing.name);
  if (pack) keys.add(`pack:${pack}`);
  if (qty) {
    const rounded = qty.baseQuantity >= 1 ? qty.baseQuantity.toFixed(2) : qty.baseQuantity.toFixed(4);
    keys.add(`qty:${qty.baseUnit}:${rounded}`);
  }
  if (keys.size === 0) {
    const token = identityTokens(listing.name)[0];
    keys.add(token ? `tok:${token}` : "unknown");
  }
  return [...keys];
}

function scoreListing(listing: IndexedListing): number {
  const brand = resolveListingBrand(listing.brand, listing.name, listing.url);
  const cleaned = cleanOfferName(listing.name);
  const national = brand && !brand.private ? 1000 : 0;
  const brandInName =
    brand && !brand.private && normalizeText(cleaned).includes(brand.key) ? 400 : 0;
  const image = listing.market.imageUrl && !/placehold/.test(listing.market.imageUrl) ? 80 : 0;
  return national + brandInName + image + Math.min(cleaned.length, 60);
}

function mode(ids: number[]): number | null {
  if (!ids.length) return null;
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

function nextFreeId(usedIds: Set<number>, members: IndexedListing[]): number {
  const hint = members[0]?.market.productGlobalId;
  if (hint != null && !usedIds.has(hint)) return hint;
  let id = 1;
  while (usedIds.has(id)) id += 1;
  return id;
}

function titleBrand(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  return key
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
