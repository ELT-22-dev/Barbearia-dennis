import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SHARE_BARBER = 0.5;

export type PaymentMethod = "dinheiro" | "pix" | "cartao";
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};

export function splitPrice(price: number) {
  const barber = Math.round(price * SHARE_BARBER * 100) / 100;
  return { barber, shop: Math.round((price - barber) * 100) / 100 };
}

export type Appt = {
  id: string;
  barber_id: string | null;
  barber_name: string;
  service_name: string;
  price: number;
  payment_method: string;
  created_at: string;
};

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
    if (a.payment_method in byPayment) byPayment[a.payment_method as PaymentMethod] += price;
  }
  return { total, shop, count: appts.length, byBarber, byPayment };
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const barbersQuery = queryOptions({
  queryKey: ["barbers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("barbers").select("*").order("position");
    if (error) throw error;
    return data;
  },
});

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .order("price", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export type Period = "hoje" | "semana" | "mes";

export function periodStart(period: Period, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "mes") d.setDate(1);
  return d;
}

export const appointmentsQuery = (period: Period) =>
  queryOptions({
    queryKey: ["appointments", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("created_at", periodStart(period).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Appt[];
    },
  });
