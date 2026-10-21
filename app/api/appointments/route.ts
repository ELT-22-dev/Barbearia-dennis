import { APPT_COLUMNS, describe, type ApptRow } from "@/lib/appointments";
import { requireUser } from "@/lib/auth";
import { isPaymentMethod } from "@/lib/barber";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, uuid } from "@/lib/http";
import { notifyAdmins } from "@/lib/push";

export const dynamic = "force-dynamic";

function timestamp(v: string | null, what: string) {
  if (v === null) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${what} inválido`);
  return d.toISOString();
}

// ?since=ISO  → lançamentos a partir do início do período (Resumo)
// ?after=ISO  → só os mais novos que esse instante (aviso de novos atendimentos)
// ?limit=N    → no máximo N, dos mais recentes
// Admin vê o histórico de todos; barbeiro, só o próprio.
export const GET = handle(async (req: Request) => {
  const me = await requireUser(req);
  const q = new URL(req.url).searchParams;
  const since = timestamp(q.get("since"), "since");
  const after = timestamp(q.get("after"), "after");
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 1000) || 1000, 1), 1000);
  const rows = await sql(
    `SELECT ${APPT_COLUMNS} FROM appointments
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at > $2)
       AND ($4::uuid IS NULL OR barber_id = $4)
     ORDER BY created_at DESC
     LIMIT $3`,
    [since, after, limit, me.role === "admin" ? null : me.id],
  );
  return Response.json(rows);
});

// Nome do barbeiro e preço vêm do banco, não do aparelho.
// Barbeiro só registra corte em nome próprio; o admin escolhe o barbeiro.
export const POST = handle(async (req: Request) => {
  const me = await requireUser(req);
  const body = await readJson(req);
  const barberId = me.role === "admin" ? uuid(body.barber_id, "Barbeiro") : me.id;
  const serviceId = uuid(body.service_id, "Serviço");
  if (!isPaymentMethod(body.payment_method)) throw new HttpError(400, "Forma de pagamento inválida");
  const [created] = await sql<ApptRow>(
    `INSERT INTO appointments (barber_id, barber_name, service_name, price, payment_method)
     SELECT b.id, b.name, s.name, s.price, $3
     FROM barbers b, services s
     WHERE b.id = $1 AND s.id = $2 AND s.active
     RETURNING ${APPT_COLUMNS}`,
    [barberId, serviceId, body.payment_method],
  );
  if (!created) throw new HttpError(404, "Barbeiro ou serviço não encontrado");
  // O admin é avisado de cada corte registrado pelos barbeiros (os dele mesmo ele já sabe).
  if (me.role !== "admin") {
    notifyAdmins({ title: `✂️ Novo corte — ${created.barber_name}`, body: describe(created), url: "/resumo" });
  }
  return Response.json(created, { status: 201 });
});
