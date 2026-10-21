import { hashPassword, newPassword, requireUser, sessionCookie } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, uuid, type IdContext } from "@/lib/http";

// Admin define/troca a senha de alguém (inclusive a própria). Sessões antigas dessa pessoa caem.
export const PUT = handle(async (req: Request, { params }: IdContext) => {
  const me = await requireUser(req, "admin");
  const id = uuid((await params).id);
  const password = newPassword((await readJson(req)).password);
  const [user] = await sql<{ id: string; session_version: number }>(
    `UPDATE barbers SET password_hash = $1, session_version = session_version + 1, failed_logins = 0, locked_until = NULL
     WHERE id = $2 RETURNING id, session_version`,
    [await hashPassword(password), id],
  );
  if (!user) throw new HttpError(404, "Barbeiro não encontrado");
  // Trocou a própria senha: renova a sessão deste aparelho para não ser deslogado.
  const headers: HeadersInit = user.id === me.id ? { "set-cookie": await sessionCookie(user) } : {};
  return Response.json({ ok: true }, { headers });
});

// Admin remove o acesso de um barbeiro: ele é deslogado na hora.
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const me = await requireUser(req, "admin");
  const id = uuid((await params).id);
  if (id === me.id) throw new HttpError(400, "Você não pode remover o próprio acesso");
  const rows = await sql(
    `UPDATE barbers SET password_hash = NULL, session_version = session_version + 1 WHERE id = $1 RETURNING id`,
    [id],
  );
  if (!rows.length) throw new HttpError(404, "Barbeiro não encontrado");
  return Response.json({ ok: true });
});
