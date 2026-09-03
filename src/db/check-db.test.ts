import { describe, expect, it } from "vitest";
import { findMissing, REQUIRED_EXTENSIONS, REQUIRED_TABLES } from "@/db/check-db";

describe("findMissing", () => {
  it("devolve vazio quando esta tudo presente", () => {
    expect(findMissing([...REQUIRED_TABLES], REQUIRED_TABLES)).toEqual([]);
  });

  it("lista o que falta", () => {
    expect(findMissing(["supermarkets"], REQUIRED_TABLES)).toContain("price_history");
    expect(findMissing(["supermarkets"], REQUIRED_TABLES)).toContain("scrape_runs");
  });

  it("ignora extras", () => {
    expect(findMissing(["a", "unaccent", "pg_trgm", "b"], REQUIRED_EXTENSIONS)).toEqual([]);
  });
});
