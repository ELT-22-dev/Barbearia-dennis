import type { Metadata } from "next";
import { Summary } from "@/components/Summary";
import { isPeriod } from "@/lib/barber";
import { requirePageAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Resumo",
  description: "Ganhos de cada barbeiro, parte da barbearia e totais por pagamento.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
  await requirePageAdmin();
  const { p } = await searchParams;
  return <Summary period={isPeriod(p) ? p : "hoje"} />;
}
