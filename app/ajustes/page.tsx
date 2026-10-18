import type { Metadata } from "next";
import { Settings } from "@/components/Settings";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Edite os nomes dos barbeiros, serviços e preços.",
};

export default function Page() {
  return <Settings />;
}
