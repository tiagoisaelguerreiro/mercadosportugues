import { describe, expect, it } from "vitest";
import { extractMicrodataPrice, parseUnitPriceLabel } from "@/scrapers/core/html";

// Fragmentos reais (Pingo Doce / Auchan, SFCC) — formato que partia a extracao
// por texto devido a spans `.sr-only` aninhados.
const PD_PROMO_BLOCK = `
<div class="product" data-pid="650223">
  <div class="product-price ">
    <span>
      <span class="sales reduced-price">
        <span class="value" content="1.39"></span>
        1,39 &euro;
      </span>
      <span class="strike-through list">
        <span class="value" content="1.79">
          <span class="sr-only">Price reduced from</span>
          1,79 &euro;
          <span class="sr-only">to</span>
        </span>
      </span>
    </span>
  </div>
</div>`;

const AUCHAN_PROMO_BLOCK = `
<div class="auc-product-tile__prices">
  <div class="price"><span>
    <div class="auc-price__stricked">
      <span class="list">
        <span class="strike-through value" content="1.64">
          <span class="sr-only">Price reduced from</span>
          1,64 &euro;
          <span class="sr-only">to</span>
        </span>
      </span>
    </div>
    <span class="sales">
      <span class="value" content="1.25">
        1,25 &euro;
      </span>
    </span>
  </span></div>
</div>`;

const PD_SIMPLE_BLOCK = `
<div class="product" data-pid="650222">
  <div class="product-price ">
    <span>
      <span class="sales ">
        <span class="value" content="0.59"></span>
        0,59 &euro;
      </span>
    </span>
  </div>
</div>`;

describe("extractMicrodataPrice", () => {
  it("le preco riscado do Pingo Doce (span aninhado)", () => {
    expect(extractMicrodataPrice(PD_PROMO_BLOCK, "strike-through")).toBe(1.79);
  });

  it("le preco de venda do Pingo Doce", () => {
    expect(extractMicrodataPrice(PD_PROMO_BLOCK, "sales")).toBe(1.39);
  });

  it("le preco riscado do Auchan (content na propria tag)", () => {
    expect(extractMicrodataPrice(AUCHAN_PROMO_BLOCK, "strike-through")).toBe(1.64);
  });

  it("le preco de venda do Auchan", () => {
    expect(extractMicrodataPrice(AUCHAN_PROMO_BLOCK, "sales")).toBe(1.25);
  });

  it("devolve null sem preco riscado (produto sem promo)", () => {
    expect(extractMicrodataPrice(PD_SIMPLE_BLOCK, "strike-through")).toBeNull();
    expect(extractMicrodataPrice(PD_SIMPLE_BLOCK, "sales")).toBe(0.59);
  });

  it("nao confunde classes parecidas", () => {
    expect(extractMicrodataPrice(PD_SIMPLE_BLOCK, "sale")).toBeNull();
  });
});

describe("parseUnitPriceLabel", () => {
  it("interpreta '1 Kg | 0,59 €/Kg'", () => {
    expect(parseUnitPriceLabel("1 Kg | 0,59 €/Kg")).toEqual({ value: 0.59, uom: "kg" });
  });

  it("interpreta '1.25 €/Kg' simples", () => {
    expect(parseUnitPriceLabel("1.25 €/Kg")).toEqual({ value: 1.25, uom: "kg" });
  });

  it("interpreta €/L", () => {
    expect(parseUnitPriceLabel("2 L | 1,10 €/L")).toEqual({ value: 1.1, uom: "L" });
  });

  it("devolve null sem valor interpretavel", () => {
    expect(parseUnitPriceLabel(null)).toBeNull();
    expect(parseUnitPriceLabel("")).toBeNull();
    expect(parseUnitPriceLabel("sem preco")).toBeNull();
  });

  it("ignora rotulo so com quantidade (sem '/') para o fallback calcular", () => {
    expect(parseUnitPriceLabel("1 Kg")).toBeNull();
    expect(parseUnitPriceLabel("250 g")).toBeNull();
  });
});
