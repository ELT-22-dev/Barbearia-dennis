// Primeiro acesso ou "esqueci a senha" do administrador: o código fica só na
// variável ADMIN_RECOVERY_CODE da Vercel, nunca no código nem no banco.
import { hashPassword, newPassword, sameSecret, sessionCookie } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const expected = process.env.ADMIN_RECOVERY_CODE;
  if (!expected) throw new HttpError(404, "Recuperação desativada");
  const body = await readJson(req);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!sameSecret(code, expected)) throw new HttpError(401, "Código inválido");
  const password = newPassword(body.password);

  const [admin] = await sql<{ id: string; session_version: number }>(
    `UPDATE barbers SET password_hash = $1, session_version = session_version + 1, failed_logins = 0, locked_until = NULL
     WHERE role = 'admin' RETURNING id, session_version`,
    [await hashPassword(password)],
  );
  if (!admin) throw new HttpError(404, "Administrador não encontrado");
  return Response.json({ ok: true }, { headers: { "set-cookie": await sessionCookie(admin) } });
});
