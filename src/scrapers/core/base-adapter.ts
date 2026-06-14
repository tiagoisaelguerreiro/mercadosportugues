import type { RawProduct } from "@/lib/types";

/**
 * Contrato comum a todos os supermercados. Cada loja implementa um Adapter
 * que sabe descobrir categorias e paginar produtos, devolvendo sempre
 * `RawProduct` normalizado — o resto do pipeline e agnostico da loja.
 */
export abstract class BaseAdapter {
  abstract readonly slug: string;
  abstract readonly supermarketId: number;

  /** IDs/slugs de categorias a percorrer. */
  abstract discoverCategories(): Promise<string[]>;

  /** Pagina uma categoria e produz produtos normalizados. */
  abstract fetchCategory(category: string): AsyncIterable<RawProduct>;

  /** Percorre todas as categorias. */
  async *fetchAll(): AsyncIterable<RawProduct> {
    const categories = await this.discoverCategories();
    for (const category of categories) {
      yield* this.fetchCategory(category);
    }
  }
}
