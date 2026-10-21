import type { Metadata } from "next";
import { Summary } from "@/components/Summary";
import { isPeriod } from "@/lib/barber";
import { requirePageUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Resumo",
  description: "Ganhos de cada barbeiro, parte da barbearia e totais por pagamento.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
  // Admin vê todos; barbeiro vê (e corrige) só os próprios cortes — filtrado na API.
  const me = await requirePageUser();
  const { p } = await searchParams;
  return <Summary me={me} period={isPeriod(p) ? p : "hoje"} />;
}
