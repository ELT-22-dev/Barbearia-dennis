import { APPT_COLUMNS, describe, when, type ApptRow } from "@/lib/appointments";
import { requireUser, type Me } from "@/lib/auth";
import { isPaymentMethod } from "@/lib/barber";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson, uuid, type IdContext } from "@/lib/http";
import { notifyAdmins } from "@/lib/push";

// Admin mexe em qualquer lançamento; barbeiro só nos próprios (os dos outros "não existem").
async function load(me: Me, id: string) {
  const [row] = await sql<ApptRow>(
    `SELECT ${APPT_COLUMNS} FROM appointments WHERE id = $1 AND ($2::uuid IS NULL OR barber_id = $2)`,
    [id, me.role === "admin" ? null : me.id],
  );
  if (!row) throw new HttpError(404, "Lançamento não encontrado");
  return row;
}

// Corrige serviço e/ou forma de pagamento (admin também pode trocar o barbeiro).
// Nome e preço vêm do banco.
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const me = await requireUser(req);
  const id = uuid((await params).id);
  const body = await readJson(req);
  const before = await load(me, id);

  let service: { name: string; price: number } | null = null;
  if (body.service_id !== undefined) {
    [service] = await sql<{ name: string; price: number }>(
      `SELECT name, price FROM services WHERE id = $1 AND active`,
      [uuid(body.service_id, "Serviço")],
    );
    if (!service) throw new HttpError(404, "Serviço não encontrado");
  }
  let payment: string | null = null;
  if (body.payment_method !== undefined) {
    if (!isPaymentMethod(body.payment_method)) throw new HttpError(400, "Forma de pagamento inválida");
    payment = body.payment_method;
  }
  let barber: { id: string; name: string } | null = null;
  if (body.barber_id !== undefined && me.role === "admin") {
    [barber] = await sql<{ id: string; name: string }>(`SELECT id, name FROM barbers WHERE id = $1`, [
      uuid(body.barber_id, "Barbeiro"),
    ]);
    if (!barber) throw new HttpError(404, "Barbeiro não encontrado");
  }
  if (!service && !payment && !barber) throw new HttpError(400, "Nada para alterar");

  const [after] = await sql<ApptRow>(
    `UPDATE appointments SET
       service_name = COALESCE($2, service_name), price = COALESCE($3, price),
       payment_method = COALESCE($4, payment_method),
       barber_id = COALESCE($5, barber_id), barber_name = COALESCE($6, barber_name)
     WHERE id = $1 RETURNING ${APPT_COLUMNS}`,
    [id, service?.name ?? null, service?.price ?? null, payment, barber?.id ?? null, barber?.name ?? null],
  );
  if (me.role !== "admin") {
    notifyAdmins({
      title: `✏️ ${me.name} corrigiu um corte`,
      body: `Antes: ${describe(before)}\nAgora: ${describe(after!)}`,
      url: "/resumo",
    });
  }
  return Response.json(after);
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const me = await requireUser(req);
  const id = uuid((await params).id);
  const row = await load(me, id);
  await sql(`DELETE FROM appointments WHERE id = $1`, [id]);
  if (me.role !== "admin") {
    notifyAdmins({
      title: `🗑️ ${me.name} apagou um corte`,
      body: `${describe(row)} (${when(row.created_at)})`,
      url: "/resumo",
    });
  }
  return Response.json({ ok: true });
});
