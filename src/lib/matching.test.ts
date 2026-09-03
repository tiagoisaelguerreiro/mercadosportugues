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

  it("nao liga iogurtes Mimosa de sabores diferentes", () => {
    const local = [
      makeGlobal({
        id: 10,
        nameGlobal: "Iogurte Aroma Morango Coco e Tutti Frutti Mimosa 8x120g",
        brand: "Mimosa",
      }),
    ];
    const out = matchProduct(
      { name: "Iogurte Aroma Morango Banana e Ananas Mimosa 8x120g", ean: null, brand: "Mimosa" },
      local,
    );
    expect(out.globalId).not.toBe(10);
  });
});

describe("nameSimilarity", () => {
  it("nomes equivalentes pontuam alto", () => {
    expect(nameSimilarity("Leite Mimosa Meio Gordo 1L", "Mimosa Leite Meio Gordo 1L")).toBeGreaterThan(0.9);
  });

  it("ignora preco por unidade e ordem da marca", () => {
    expect(
      nameSimilarity(
        "Leite UHT Meio Gordo Mimosa 1 lt",
        "Leite UHT Meio Gordo 1 L | 0,9 €/L",
      ),
    ).toBeGreaterThan(0.75);
  });
});

describe("match entre lojas com nomes diferentes", () => {
  it("liga Mimosa 1L apesar do nome da loja ser diferente", () => {
    const candidates = [
      makeGlobal({ id: 1, nameGlobal: "Leite UHT Meio Gordo Mimosa 1 lt", brand: "Mimosa" }),
    ];
    const out = matchProduct(
      { name: "Leite UHT Meio Gordo 1 L | 0,9 €/L", ean: null, brand: "Mimosa" },
      candidates,
    );
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(1);
  });

  it("liga Mimosa pelo slug do URL quando o nome da loja omite a marca", () => {
    const candidates = [
      makeGlobal({ id: 1, nameGlobal: "Leite UHT Meio Gordo Mimosa 1 lt", brand: "Mimosa" }),
    ];
    const out = matchProduct(
      {
        name: "Leite UHT Meio Gordo 1 L | 0,9 €/L",
        ean: null,
        brand: "Pingo Doce",
        productUrl: "https://www.pingodoce.pt/home/produtos/leite-uht-meio-gordo-mimosa-41043.html",
      },
      candidates,
    );
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(1);
  });

  it("nao mistura Mimosa com marca propria do Pingo Doce", () => {
    const candidates = [
      makeGlobal({ id: 1, nameGlobal: "Leite UHT Meio Gordo Mimosa 1 lt", brand: "Mimosa" }),
    ];
    const out = matchProduct(
      { name: "Leite UHT Meio Gordo 1 L | 0,86 €/L", ean: null, brand: "Pingo Doce" },
      candidates,
    );
    expect(out.globalId).not.toBe(1);
  });

  it("liga arroz Cigala com casing e espacos diferentes", () => {
    const candidates = [makeGlobal({ id: 4, nameGlobal: "Arroz Agulha Cigala 1 kg", brand: "Cigala" })];
    const out = matchProduct({ name: "arroz agulha cigala 1kg", ean: null, brand: "Cigala" }, candidates);
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(4);
  });

  it("nao liga ovos classe M com classe L", () => {
    const candidates = [
      makeGlobal({ id: 7, nameGlobal: "Ovos de Solo Classe M Continente 12 un", brand: "Continente" }),
    ];
    const out = matchProduct(
      { name: "Ovos de Solo Classe L 12 Un", ean: null, brand: "Pingo Doce" },
      candidates,
    );
    expect(out.globalId).not.toBe(7);
  });

  it("nao liga arroz Cigala a arroz de marca propria", () => {
    const candidates = [makeGlobal({ id: 4, nameGlobal: "Arroz Agulha Cigala 1 kg", brand: "Cigala" })];
    const out = matchProduct(
      { name: "arroz agulha auchan extra longo branqueado 1kg", ean: null, brand: null },
      candidates,
    );
    expect(out.globalId).not.toBe(4);
  });

  it("liga Heineken pack 24 com 24 x 25 cl", () => {
    const candidates = [
      makeGlobal({ id: 11, nameGlobal: "Cerveja com Álcool Heineken 24 x 25 cl", brand: "Heineken" }),
    ];
    const out = matchProduct(
      {
        name: "Cerveja com Álcool Pack 24",
        ean: null,
        brand: null,
        productUrl: "https://www.pingodoce.pt/home/produtos/cerveja-com-alcool-pack-24-heineken-840092.html",
      },
      candidates,
    );
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(11);
  });

  it("nao liga cafe Delta intenso com classico", () => {
    const candidates = [makeGlobal({ id: 12, nameGlobal: "Café Solúvel Intenso Delta 200 gr", brand: "Delta" })];
    const out = matchProduct(
      {
        name: "Café Solúvel Clássico 0.2 Kg | 34,95 €/Kg",
        ean: null,
        brand: null,
        productUrl: "https://www.pingodoce.pt/home/produtos/cafe-soluvel-classico-delta-755141.html",
      },
      candidates,
    );
    expect(out.globalId).not.toBe(12);
  });

  it("liga Nestum mesmo quando uma loja acrescenta flocos/idade", () => {
    const candidates = [makeGlobal({ id: 13, nameGlobal: "Nestum Mel Flocos Cereais +3A 600 gr", brand: "Nestum" })];
    const out = matchProduct(
      {
        name: "Nestum de Mel 0.6 Kg | 6,65 €/Kg",
        ean: null,
        brand: null,
        productUrl: "https://www.pingodoce.pt/home/produtos/nestum-de-mel-nestum-942462.html",
      },
      candidates,
    );
    expect(out.status).toBe("matched");
    expect(out.globalId).toBe(13);
  });

  it("nao liga Coca-Cola Zero a Coca-Cola original", () => {
    const candidates = [
      makeGlobal({ id: 14, nameGlobal: "Refrigerante com Gás Cola Zero Coca-Cola 2 x 1,75 lt", brand: "Coca-Cola" }),
    ];
    const out = matchProduct(
      { name: "Refrigerante Coca-Cola Original Pack 2", ean: null, brand: "Coca-Cola" },
      candidates,
    );
    expect(out.globalId).not.toBe(14);
  });

  it("nao liga cafe em grao a cafe moido", () => {
    const candidates = [makeGlobal({ id: 15, nameGlobal: "Café em Grão Torrado Lote Chávena Delta 250 gr", brand: "Delta" })];
    const out = matchProduct(
      { name: "Café Torrado Moído Moagem Máquina Lote Chávena 0.25 Kg", ean: null, brand: "Delta" },
      candidates,
    );
    expect(out.globalId).not.toBe(15);
  });

  it("nao liga leite achocolatado Mimosa a leite branco pack 4", () => {
    const candidates = [
      makeGlobal({ id: 17, nameGlobal: "Leite Achocolatado sem Lactose Mimosa 4 x 200 ml", brand: "Mimosa" }),
    ];
    const out = matchProduct(
      {
        name: "Leite UHT Meio Gordo sem Lactose Pack 4",
        ean: null,
        brand: "Mimosa",
        productUrl: "https://www.pingodoce.pt/home/produtos/leite-uht-meio-gordo-sem-lactose-pack-4-mimosa-863256.html",
      },
      candidates,
    );
    expect(out.globalId).not.toBe(17);
  });
});
