import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, text, uuid, type IdContext } from "@/lib/http";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireUser(req, "admin");
  const id = uuid((await params).id);
  const body = await readJson(req);
  const name = text(body.name, "o nome");
  const rows = await sql(`UPDATE barbers SET name = $1 WHERE id = $2 RETURNING id, name, position`, [name, id]);
  if (!rows.length) throw new HttpError(404, "Barbeiro não encontrado");
  return Response.json(rows[0]);
});
