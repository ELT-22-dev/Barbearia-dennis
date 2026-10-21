import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, userFromToken } from "./auth";

// Para páginas (Server Components). A proteção real dos dados fica nas API routes.
export const pageUser = cache(async () => userFromToken((await cookies()).get(SESSION_COOKIE)?.value));

export async function requirePageUser() {
  const me = await pageUser();
  if (!me) redirect("/login");
  return me;
}

export async function requirePageAdmin() {
  const me = await requirePageUser();
  if (me.role !== "admin") redirect("/");
  return me;
}
