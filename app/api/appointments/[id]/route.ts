import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, uuid, type IdContext } from "@/lib/http";

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  await requireUser(req, "admin");
  const id = uuid((await params).id);
  const rows = await sql(`DELETE FROM appointments WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw new HttpError(404, "Lançamento não encontrado");
  return Response.json({ ok: true });
});
