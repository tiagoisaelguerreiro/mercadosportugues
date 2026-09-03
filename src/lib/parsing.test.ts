import { describe, expect, it } from "vitest";
import {
  computePricePerUnit,
  normalizeText,
  parsePrice,
  parseQuantity,
  stripAccents,
} from "@/lib/parsing";

describe("stripAccents", () => {
  it("remove diacriticos PT", () => {
    expect(stripAccents("Intermarché")).toBe("Intermarche");
    expect(stripAccents("Pão de Ló")).toBe("Pao de Lo");
    expect(stripAccents("açúcar")).toBe("acucar");
  });
});

describe("normalizeText", () => {
  it("minusculas, sem acentos e sem pontuacao extra", () => {
    expect(normalizeText("Leite  UHT, Meio-Gordo!")).toBe("leite uht meio gordo");
  });
});

describe("parseQuantity", () => {
  it("interpreta unidade simples kg", () => {
    expect(parseQuantity("Arroz Agulha Cigala 1kg")).toMatchObject({
      value: 1,
      unit: "kg",
      baseUnit: "kg",
      baseQuantity: 1,
    });
  });

  it("converte gramas para kg base", () => {
    expect(parseQuantity("Manteiga Mimosa 250g")).toMatchObject({
      baseUnit: "kg",
      baseQuantity: 0.25,
    });
  });

  it("interpreta litros e mililitros", () => {
    expect(parseQuantity("Leite UHT Mimosa 1L")).toMatchObject({ baseUnit: "L", baseQuantity: 1 });
    expect(parseQuantity("Detergente 500 ml")).toMatchObject({ baseUnit: "L", baseQuantity: 0.5 });
    expect(parseQuantity("Sumo 1.5L")).toMatchObject({ baseUnit: "L", baseQuantity: 1.5 });
  });

  it("aceita virgula decimal", () => {
    expect(parseQuantity("Coca-Cola 1,5L")).toMatchObject({ baseQuantity: 1.5 });
  });

  it("expande multipacks", () => {
    expect(parseQuantity("Iogurte Activia 4x125g")).toMatchObject({
      baseUnit: "kg",
      baseQuantity: 0.5,
    });
    expect(parseQuantity("Agua Luso 6x1.5L")).toMatchObject({
      baseUnit: "L",
      baseQuantity: 9,
    });
  });

  it("conta unidades", () => {
    expect(parseQuantity("Ovos Classe M 6 un")).toMatchObject({ baseUnit: "un", baseQuantity: 6 });
    expect(parseQuantity("Cerveza Clásica Steinburg Pack-12")).toMatchObject({
      baseUnit: "un",
      baseQuantity: 12,
    });
    expect(parseQuantity("Detergente Skip 76 Dos")).toMatchObject({
      baseUnit: "un",
      baseQuantity: 76,
    });
  });

  it("devolve null sem quantidade reconhecivel", () => {
    expect(parseQuantity("Produto sem medida")).toBeNull();
  });

  it("ignora preco por kg/L colado ao nome e peso escorrido", () => {
    expect(parseQuantity("Leite UHT Meio Gordo 1 L | 0,9 €/L")).toMatchObject({
      baseUnit: "L",
      baseQuantity: 1,
    });
    expect(parseQuantity("Atum Posta em Óleo 120 gr (peso escorrido 78 gr)")).toMatchObject({
      baseUnit: "kg",
      baseQuantity: 0.12,
    });
    expect(parseQuantity("atum posta auchan ao natural 120 (84)g")).toMatchObject({
      baseUnit: "kg",
      baseQuantity: 0.12,
    });
  });
});

describe("parsePrice", () => {
  it("interpreta formatos PT", () => {
    expect(parsePrice("1,29 €")).toBe(1.29);
    expect(parsePrice("€2.50")).toBe(2.5);
    expect(parsePrice("1.234,56")).toBe(1234.56);
    expect(parsePrice(3.2)).toBe(3.2);
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("sem preco")).toBeNull();
  });
});

describe("computePricePerUnit", () => {
  it("calcula €/kg", () => {
    const q = parseQuantity("Arroz 1kg");
    expect(computePricePerUnit(0.99, q)).toEqual({ value: 0.99, uom: "kg" });
  });

  it("calcula €/L para 500ml", () => {
    const q = parseQuantity("Azeite 500ml");
    expect(computePricePerUnit(3.5, q)).toEqual({ value: 7, uom: "L" });
  });

  it("devolve null para unidades contadas", () => {
    const q = parseQuantity("Ovos 6 un");
    expect(computePricePerUnit(1.5, q)).toBeNull();
  });
});
