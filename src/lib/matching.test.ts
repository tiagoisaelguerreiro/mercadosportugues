import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  jaroWinkler,
  levenshtein,
  levenshteinRatio,
  matchProduct,
  nameSimilarity,
  sameSize,
  tokenize,
  type MatchCandidate,
} from "@/lib/matching";
import { parseQuantity } from "@/lib/parsing";
import type { ProductGlobal } from "@/lib/types";

describe("tokenize / canonicalKey", () => {
  it("remove stop words e numeros e ordena", () => {
    expect(tokenize("Arroz Agulha de Cigala 1kg")).toEqual(["agulha", "arroz", "cigala", "kg"]);
  });

  it("torna a ordem das palavras irrelevante", () => {
    expect(canonicalKey("Leite Meio Gordo Mimosa")).toBe(canonicalKey("Mimosa Leite Gordo Meio"));
  });
});

describe("levenshtein", () => {
  it("calcula distancia conhecida", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("ratio normalizado", () => {
    expect(levenshteinRatio("abc", "abc")).toBe(1);
    expect(levenshteinRatio("", "")).toBe(1);
  });
});

describe("jaroWinkler", () => {
  it("identicos = 1", () => {
    expect(jaroWinkler("martha", "martha")).toBe(1);
  });
  it("classico martha/marhta ~0.96", () => {
    expect(jaroWinkler("martha", "marhta")).toBeGreaterThan(0.96);
  });
});

describe("sameSize (veto de tamanho)", () => {
  it("mesmo tamanho passa", () => {
    expect(sameSize(parseQuantity("Leite 1L"), parseQuantity("Leite 1L"))).toBe(true);
  });
  it("tamanhos diferentes bloqueiam", () => {
    expect(sameSize(parseQuantity("Leite 1L"), parseQuantity("Leite 1.5L"))).toBe(false);
  });
  it("g vs kg equivalentes passam", () => {
    expect(sameSize(parseQuantity("Manteiga 1000g"), parseQuantity("Manteiga 1kg"))).toBe(true);
  });
  it("unidades diferentes bloqueiam", () => {
    expect(sameSize(parseQuantity("X 1kg"), parseQuantity("X 1L"))).toBe(false);
  });
  it("um com quantidade e outro sem bloqueia", () => {
    expect(sameSize(parseQuantity("X 1kg"), null)).toBe(false);
  });
});

function makeGlobal(partial: Partial<ProductGlobal> & { id: number; nameGlobal: string }): MatchCandidate {
  return {
    brand: null,
    eanCode: null,
    categoryId: null,
    imageUrl: null,
    quantityValue: null,
    quantityUnit: null,
    baseUnit: null,
    baseQuantity: null,
    ...partial,
  };
}

describe("matchProduct", () => {
  const candidates: MatchCandidate[] = [
    makeGlobal({ id: 1, nameGlobal: "Arroz Agulha 1kg", brand: "Cigala", eanCode: "5601234567890" }),
    makeGlobal({ id: 2, nameGlobal: "Leite UHT Meio Gordo 1L", brand: "Mimosa" }),
    makeGlobal({ id: 3, nameGlobal: "Leite UHT Meio Gordo 1.5L", brand: "Mimosa" }),
  ];

  it("1) match por EAN tem prioridade e confianca 1", () => {
    const out = matchProduct(
      { name: "Qualquer nome diferente 1kg", ean: "5601234567890" },
      candidates,
    );
    expect(out).toEqual({ status: "matched", globalId: 1, confidence: 1 });
  });

  it("2) match por nome com mesmo tamanho", () => {
    const out = matchProduct(
      { name: "Leite Meio Gordo UHT Mimosa 1L", ean: null },
      candidates,
    );
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(2);
  });

  it("veto de tamanho impede juntar 1L com 1.5L", () => {
    // Nome quase identico ao global 1.5L, mas pedimos 1L -> tem de cair no global 1L (id 2)
    const out = matchProduct(
      { name: "Leite UHT Meio Gordo Mimosa 1L", ean: null },
      candidates,
    );
    expect(out.globalId).not.toBe(3);
  });

  it("produto novo sem semelhanca -> orphan", () => {
    const out = matchProduct({ name: "Bolachas Maria 200g", ean: null }, candidates);
    expect(out.status).toBe("orphan");
    expect(out.globalId).toBeNull();
  });

  it("semelhanca intermedia -> review", () => {
    const local = [makeGlobal({ id: 10, nameGlobal: "Iogurte Natural Acucarado 4x125g", brand: "Continente" })];
    const out = matchProduct(
      { name: "Iogurte Natural 4x125g", ean: null },
      local,
      undefined,
      { auto: 0.99, review: 0.5 },
    );
    expect(out.status).toBe("review");
    expect(out.globalId).toBe(10);
  });
});

describe("nameSimilarity", () => {
  it("nomes equivalentes pontuam alto", () => {
    expect(nameSimilarity("Leite Mimosa Meio Gordo 1L", "Mimosa Leite Meio Gordo 1L")).toBeGreaterThan(0.9);
  });
});
