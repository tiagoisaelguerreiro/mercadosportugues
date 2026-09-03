import { describe, expect, it } from "vitest";
import { basketShareUrl, decodeBasket, encodeBasket } from "./basket-share";

describe("encodeBasket / decodeBasket", () => {
  it("codifica quantidades unitarias sem sufixo", () => {
    expect(encodeBasket([{ productGlobalId: 12, quantity: 1 }, { productGlobalId: 7, quantity: 3 }])).toBe("12,7x3");
  });

  it("faz round-trip", () => {
    const lines = [
      { productGlobalId: 1, quantity: 2 },
      { productGlobalId: 45, quantity: 1 },
      { productGlobalId: 9, quantity: 5 },
    ];
    expect(decodeBasket(encodeBasket(lines))).toEqual(lines);
  });

  it("ignora entradas invalidas e funde duplicados", () => {
    expect(decodeBasket("abc,3x0,5x2,5,-1,7xx2, 8 ")).toEqual([
      { productGlobalId: 5, quantity: 3 },
      { productGlobalId: 8, quantity: 1 },
    ]);
  });

  it("limita quantidades absurdas", () => {
    expect(decodeBasket("5x1000")).toEqual([{ productGlobalId: 5, quantity: 99 }]);
    expect(encodeBasket([{ productGlobalId: 5, quantity: 1000 }])).toBe("5x99");
  });

  it("devolve vazio para input vazio", () => {
    expect(decodeBasket(null)).toEqual([]);
    expect(decodeBasket("")).toEqual([]);
    expect(encodeBasket([])).toBe("");
  });

  it("constroi a URL de partilha", () => {
    expect(basketShareUrl("https://x.pt", [{ productGlobalId: 1, quantity: 2 }])).toBe("https://x.pt/carrinho?itens=1x2");
    expect(basketShareUrl("https://x.pt", [])).toBe("https://x.pt/carrinho");
  });
});
