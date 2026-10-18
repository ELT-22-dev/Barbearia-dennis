import { isPaymentMethod } from "@/lib/barber";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, uuid } from "@/lib/http";

export const dynamic = "force-dynamic";

const COLUMNS = `id, barber_id, barber_name, service_name, price::float8 AS price, payment_method,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`;

function timestamp(v: string | null, what: string) {
  if (v === null) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${what} inválido`);
  return d.toISOString();
}

// ?since=ISO  → lançamentos a partir do início do período (Resumo)
// ?after=ISO  → só os mais novos que esse instante (aviso de novos atendimentos)
// ?limit=N    → no máximo N, dos mais recentes
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const since = timestamp(q.get("since"), "since");
  const after = timestamp(q.get("after"), "after");
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 1000) || 1000, 1), 1000);
  const rows = await sql(
    `SELECT ${COLUMNS} FROM appointments
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at > $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [since, after, limit],
  );
  return Response.json(rows);
});

// Nome do barbeiro e preço vêm do banco, não do aparelho.
export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const barberId = uuid(body.barber_id, "Barbeiro");
  const serviceId = uuid(body.service_id, "Serviço");
  if (!isPaymentMethod(body.payment_method)) throw new HttpError(400, "Forma de pagamento inválida");
  const rows = await sql(
    `INSERT INTO appointments (barber_id, barber_name, service_name, price, payment_method)
     SELECT b.id, b.name, s.name, s.price, $3
     FROM barbers b, services s
     WHERE b.id = $1 AND s.id = $2 AND s.active
     RETURNING ${COLUMNS}`,
    [barberId, serviceId, body.payment_method],
  );
  if (!rows.length) throw new HttpError(404, "Barbeiro ou serviço não encontrado");
  return Response.json(rows[0], { status: 201 });
});
