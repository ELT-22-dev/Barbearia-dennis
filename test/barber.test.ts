import { describe, expect, it } from "vitest";
import { parsePrice, periodStart, splitPrice, summarize } from "@/lib/barber";

describe("divisão 50/50", () => {
  it("corte de R$30 dá R$15 para cada", () => {
    expect(splitPrice(30)).toEqual({ barber: 15, shop: 15 });
  });
  it("corte de R$25 dá R$12,50 para cada", () => {
    expect(splitPrice(25)).toEqual({ barber: 12.5, shop: 12.5 });
  });
  it("centavo ímpar fica com a barbearia, sem perder dinheiro", () => {
    const s = splitPrice(25.25);
    expect(s.barber + s.shop).toBeCloseTo(25.25);
  });
  it("totais por barbeiro e pagamento", () => {
    const base = { service_name: "Corte", created_at: "" };
    const s = summarize([
      { ...base, id: "1", barber_id: "a", barber_name: "A", price: 30, payment_method: "pix" },
      { ...base, id: "2", barber_id: "a", barber_name: "A", price: 25, payment_method: "dinheiro" },
      { ...base, id: "3", barber_id: "b", barber_name: "B", price: 30, payment_method: "pix" },
    ]);
    expect(s.total).toBe(85);
    expect(s.shop).toBe(42.5);
    expect(s.byBarber["a"]?.earned).toBe(27.5);
    expect(s.byPayment.pix).toBe(60);
  });
});

describe("períodos", () => {
  const sat = new Date(2026, 9, 17, 15, 30); // sábado
  it("semana começa na segunda", () => {
    expect(periodStart("semana", sat)).toEqual(new Date(2026, 9, 12));
  });
  it("mês começa no dia 1", () => {
    expect(periodStart("mes", sat)).toEqual(new Date(2026, 9, 1));
  });
});

describe("preço", () => {
  it("aceita vírgula", () => expect(parsePrice("27,5")).toBe(27.5));
  it("recusa zero, negativo e texto", () => {
    expect(parsePrice("0")).toBeNull();
    expect(parsePrice("-3")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });
});
