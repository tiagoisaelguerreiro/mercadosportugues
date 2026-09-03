import { describe, expect, it } from "vitest";
import { formatDateLong, formatDatePt, parseIsoDate } from "@/lib/format";

describe("parseIsoDate", () => {
  it("trata YYYY-MM-DD como data civil, sem recuar por UTC", () => {
    const d = parseIsoDate("2026-09-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(2);
  });
});

describe("formatDatePt", () => {
  it("mantem o dia do historico", () => {
    expect(formatDatePt("2026-09-02")).toMatch(/02/);
    expect(formatDateLong("2026-09-02")).toMatch(/2026/);
  });
});
