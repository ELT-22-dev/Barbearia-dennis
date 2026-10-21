import { clearedSessionCookie } from "@/lib/auth";

export function POST() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie() } });
}
