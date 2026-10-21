import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Login, type LoginOption } from "@/components/Login";
import { sql } from "@/lib/db";
import { pageUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso dos barbeiros e do administrador da barbearia.",
};

export default async function Page() {
  if (await pageUser()) redirect("/");
  const options = await sql<LoginOption>(
    `SELECT id, name, role, password_hash IS NOT NULL AS has_access FROM barbers ORDER BY position, created_at`,
  );
  return <Login options={options} />;
}
