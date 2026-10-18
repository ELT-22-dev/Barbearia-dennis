import { sql } from "@/lib/db";
import { handle, HttpError, uuid, type IdContext } from "@/lib/http";

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  const id = uuid((await params).id);
  const rows = await sql(`DELETE FROM appointments WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw new HttpError(404, "Lançamento não encontrado");
  return Response.json({ ok: true });
});
