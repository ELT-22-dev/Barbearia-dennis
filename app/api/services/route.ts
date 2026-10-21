import { requireUser } from "@/lib/auth";
import { parsePrice } from "@/lib/barber";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, text } from "@/lib/http";

export const dynamic = "force-dynamic";

const SERVICE_COLUMNS = `id, name, price::float8 AS price`;

export const GET = handle(async (req: Request) => {
  await requireUser(req);
  const rows = await sql(
    `SELECT ${SERVICE_COLUMNS} FROM services WHERE active ORDER BY price DESC, created_at`,
  );
  return Response.json(rows);
});

export const POST = handle(async (req: Request) => {
  await requireUser(req, "admin");
  const body = await readJson(req);
  const name = text(body.name, "o nome do serviço");
  const price = parsePrice(body.price);
  if (price === null) throw new HttpError(400, "Preço inválido");
  const rows = await sql(
    `INSERT INTO services (name, price) VALUES ($1, $2) RETURNING ${SERVICE_COLUMNS}`,
    [name, price],
  );
  return Response.json(rows[0], { status: 201 });
});
