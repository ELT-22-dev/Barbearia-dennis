import { LOCK_MINUTES, MAX_FAILED_LOGINS, sessionCookie, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, uuid } from "@/lib/http";

type Row = { id: string; password_hash: string | null; session_version: number; wait_min: number | null };

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const id = uuid(body.barber_id, "Barbeiro");
  const password = typeof body.password === "string" ? body.password : "";

  const [user] = await sql<Row>(
    `SELECT id, password_hash, session_version,
       CASE WHEN locked_until > now() THEN ceil(extract(epoch FROM locked_until - now()) / 60)::int END AS wait_min
     FROM barbers WHERE id = $1`,
    [id],
  );
  if (!user) throw new HttpError(404, "Barbeiro não encontrado");
  if (!user.password_hash) throw new HttpError(403, "Seu acesso ainda não foi liberado. Peça ao administrador.");
  if (user.wait_min) throw new HttpError(429, `Muitas tentativas. Tente de novo em ${user.wait_min} min.`);

  if (!(await verifyPassword(password, user.password_hash))) {
    // Depois de N erros seguidos, bloqueia o login dessa pessoa por alguns minutos.
    await sql(
      `UPDATE barbers SET
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
         locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1`,
      [id, MAX_FAILED_LOGINS, LOCK_MINUTES],
    );
    throw new HttpError(401, "Senha incorreta");
  }

  await sql(`UPDATE barbers SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [id]);
  return Response.json({ ok: true }, { headers: { "set-cookie": await sessionCookie(user) } });
});
