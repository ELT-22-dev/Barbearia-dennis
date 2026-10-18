import type { Metadata } from "next";
import { NewAppointment } from "@/components/NewAppointment";

export const metadata: Metadata = {
  title: { absolute: "Novo atendimento — Barbearia" },
  description: "Registre cortes, forma de pagamento e veja a divisão 50/50 na hora.",
};

export default function Page() {
  return <NewAppointment />;
}
