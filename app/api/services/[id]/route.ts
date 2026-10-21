import { requireUser } from "@/lib/auth";
import { parsePrice } from "@/lib/barber";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, text, uuid, type IdContext } from "@/lib/http";

const COLUMNS = `id, name, price::float8 AS price`;

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireUser(req, "admin");
  const id = uuid((await params).id);
  const body = await readJson(req);
  const name = body.name === undefined ? null : text(body.name, "o nome do serviço");
  let price: number | null = null;
  if (body.price !== undefined) {
    price = parsePrice(body.price);
    if (price === null) throw new HttpError(400, "Preço inválido");
  }
  if (name === null && price === null) throw new HttpError(400, "Nada para alterar");
  const rows = await sql(
    `UPDATE services SET name = COALESCE($1, name), price = COALESCE($2, price)
     WHERE id = $3 AND active RETURNING ${COLUMNS}`,
    [name, price, id],
  );
  if (!rows.length) throw new HttpError(404, "Serviço não encontrado");
  return Response.json(rows[0]);
});

// Remoção lógica: lançamentos antigos guardam nome e preço, então nada se perde.
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  await requireUser(req, "admin");
  const id = uuid((await params).id);
  const rows = await sql(`UPDATE services SET active = false WHERE id = $1 AND active RETURNING id`, [id]);
  if (!rows.length) throw new HttpError(404, "Serviço não encontrado");
  return Response.json({ ok: true });
});
