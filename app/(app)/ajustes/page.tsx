import type { Metadata } from "next";
import { Settings } from "@/components/Settings";
import { requirePageAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Barbeiros, acessos, serviços e preços.",
};

export default async function Page() {
  const me = await requirePageAdmin();
  return <Settings me={me} />;
}
