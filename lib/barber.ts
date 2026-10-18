export const SHARE_BARBER = 0.5;

export type PaymentMethod = "dinheiro" | "pix" | "cartao";
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};
export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && v in PAYMENT_LABELS;

export type Barber = { id: string; name: string; position: number };
export type Service = { id: string; name: string; price: number };
export type Appt = {
  id: string;
  barber_id: string | null;
  barber_name: string;
  service_name: string;
  price: number;
  payment_method: string;
  created_at: string;
};

export function splitPrice(price: number) {
  const barber = Math.round(price * SHARE_BARBER * 100) / 100;
  return { barber, shop: Math.round((price - barber) * 100) / 100 };
}

export function summarize(appts: Appt[]) {
  let total = 0;
  let shop = 0;
  const byBarber: Record<string, { name: string; count: number; earned: number }> = {};
  const byPayment: Record<PaymentMethod, number> = { dinheiro: 0, pix: 0, cartao: 0 };
  for (const a of appts) {
    const price = Number(a.price);
    const s = splitPrice(price);
    total += price;
    shop += s.shop;
    const key = a.barber_id ?? a.barber_name;
    byBarber[key] ??= { name: a.barber_name, count: 0, earned: 0 };
    byBarber[key].count += 1;
    byBarber[key].earned += s.barber;
    if (isPaymentMethod(a.payment_method)) byPayment[a.payment_method] += price;
  }
  return { total, shop, count: appts.length, byBarber, byPayment };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Period = "hoje" | "semana" | "mes";
export const isPeriod = (v: unknown): v is Period => v === "hoje" || v === "semana" || v === "mes";

// Início do período no fuso do aparelho (a barbearia), não do servidor.
export function periodStart(period: Period, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "mes") d.setDate(1);
  return d;
}

export const parsePrice = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
