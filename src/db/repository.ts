import type { Repository } from "@/db/repository-types";
import { InMemoryRepository } from "@/db/in-memory-repository";

/**
 * Seletor de repositorio. Por defeito usa o repositorio em memoria (dados seed),
 * que funciona sem qualquer infraestrutura. Define USE_DB=true (e DATABASE_URL)
 * para usar PostgreSQL via Drizzle.
 *
 * A API e o frontend importam apenas `getRepository()` e dependem do contrato
 * `Repository` — a origem dos dados e transparente.
 *
 * Nota: a versao PostgreSQL e injetada por `setRepositoryFactory` (chamada no
 * arranque do servidor) para manter este modulo livre do driver pg quando se
 * usa o modo em memoria.
 */
let instance: Repository | null = null;
let factory: (() => Repository) | null = null;

export function setRepositoryFactory(make: () => Repository): void {
  factory = make;
  instance = null;
}

export function getRepository(): Repository {
  if (instance) return instance;
  if (process.env.USE_DB === "true" && factory) {
    instance = factory();
  } else {
    instance = new InMemoryRepository();
  }
  return instance;
}

export type { Repository } from "@/db/repository-types";
