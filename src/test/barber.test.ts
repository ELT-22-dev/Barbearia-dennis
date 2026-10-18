import { describe, it, expect } from "vitest";
import { splitPrice, summarize } from "@/lib/barber";

describe("divisão 50/50", () => {
  it("corte de R$30 dá R$15 para cada", () => {
    expect(splitPrice(30)).toEqual({ barber: 15, shop: 15 });
  });
  it("corte de R$25 dá R$12,50 para cada", () => {
    expect(splitPrice(25)).toEqual({ barber: 12.5, shop: 12.5 });
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

import { isAdminEmail } from "@/lib/auth";
describe("admin", () => {
  it("only Dennis's email is the admin email", () => {
    expect(isAdminEmail(" ZulmaZerna2020@gmail.com ")).toBe(true);
    expect(isAdminEmail("eddy@gmail.com")).toBe(false);
  });
});
