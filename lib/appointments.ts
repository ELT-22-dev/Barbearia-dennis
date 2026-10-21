import { brl, PAYMENT_LABELS, type PaymentMethod } from "./barber";

export const APPT_COLUMNS = `id, barber_id, barber_name, service_name, price::float8 AS price, payment_method,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`;

export type ApptRow = {
  id: string;
  barber_id: string | null;
  barber_name: string;
  service_name: string;
  price: number;
  payment_method: string;
  created_at: string;
};

/** "Corte · R$ 30,00 · Pix" */
export const describe = (a: Pick<ApptRow, "service_name" | "price" | "payment_method">) =>
  `${a.service_name} · ${brl(a.price)} · ${PAYMENT_LABELS[a.payment_method as PaymentMethod] ?? a.payment_method}`;

/** Data/hora no fuso da barbearia (o servidor roda em UTC). */
export const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
