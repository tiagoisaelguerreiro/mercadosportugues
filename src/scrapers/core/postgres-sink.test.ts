import { describe, expect, it } from "vitest";
import { pickOfferEan } from "@/scrapers/core/postgres-sink";

describe("pickOfferEan (preservacao de EAN enriquecido)", () => {
  it("prefere o EAN da grelha quando existe", () => {
    expect(pickOfferEan("5601809013014", "5601809011409")).toBe("5601809013014");
  });

  it("reutiliza o guardado quando a grelha nao traz", () => {
    expect(pickOfferEan(null, "5601809013014")).toBe("5601809013014");
    expect(pickOfferEan(undefined, "5601809013014")).toBe("5601809013014");
  });

  it("devolve null sem nenhum", () => {
    expect(pickOfferEan(null, null)).toBeNull();
    expect(pickOfferEan(undefined, undefined)).toBeNull();
  });
});
