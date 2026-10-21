import type { Metadata } from "next";
import { NewAppointment } from "@/components/NewAppointment";
import { requirePageUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "Novo atendimento — Barbearia" },
  description: "Registre cortes, forma de pagamento e veja a divisão 50/50 na hora.",
};

export default async function Page() {
  const me = await requirePageUser();
  return <NewAppointment me={me} />;
}
