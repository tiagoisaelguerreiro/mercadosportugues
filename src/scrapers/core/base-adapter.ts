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

  /** Percorre todas as categorias. Uma categoria em 404/erro nao aborta a loja. */
  async *fetchAll(): AsyncIterable<RawProduct> {
    const categories = await this.discoverCategories();
    console.log(`  ${this.slug}: a percorrer ${categories.length} categorias`);
    let yielded = 0;
    const errors: string[] = [];
    let index = 0;
    for (const category of categories) {
      index += 1;
      if (index === 1 || index % 25 === 0 || index === categories.length) {
        console.log(`  ${this.slug}: categoria ${index}/${categories.length}`);
      }
      try {
        for await (const product of this.fetchCategory(category)) {
          yielded += 1;
          yield product;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${category}: ${message}`);
        console.warn(`⚠ ${this.slug} categoria "${category}" ignorada: ${message}`);
      }
    }
    if (yielded === 0 && errors.length > 0) {
      throw new Error(`Nenhum produto em ${this.slug}: ${errors.join("; ")}`);
    }
  }
}
