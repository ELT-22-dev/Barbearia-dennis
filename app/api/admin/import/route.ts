// TEMPORÁRIO: importação única do histórico do app Lovable. Remover depois do uso.
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";

const digest = (v: string) => createHash("sha256").update(v).digest();

export const POST = handle(async (req: Request) => {
  const token = process.env.IMPORT_TOKEN;
  if (!token) throw new HttpError(404, "Not found");
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(token))) throw new HttpError(401, "Unauthorized");

  const body = await readJson(req);
  const data = JSON.stringify({
    barbers: body.barbers ?? [],
    services: body.services ?? [],
    appointments: body.appointments ?? [],
  });

  // Upserts idempotentes: rodar de novo não duplica nada.
  await sql(
    `INSERT INTO barbers (id, name, position, created_at)
     SELECT id, name, position, created_at FROM jsonb_to_recordset($1::jsonb->'barbers')
       AS x(id uuid, name text, position int, created_at timestamptz)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position`,
    [data],
  );
  await sql(
    `INSERT INTO services (id, name, price, active, created_at)
     SELECT id, name, price, active, created_at FROM jsonb_to_recordset($1::jsonb->'services')
       AS x(id uuid, name text, price numeric, active boolean, created_at timestamptz)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, active = EXCLUDED.active`,
    [data],
  );
  await sql(
    `INSERT INTO appointments (id, barber_id, barber_name, service_name, price, payment_method, created_at)
     SELECT id, barber_id, barber_name, service_name, price, payment_method, date_trunc('milliseconds', created_at)
     FROM jsonb_to_recordset($1::jsonb->'appointments')
       AS x(id uuid, barber_id uuid, barber_name text, service_name text, price numeric, payment_method text, created_at timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [data],
  );
  // Tira os barbeiros/serviços genéricos iniciais, sem tocar em nada que tenha lançamento.
  await sql(
    `DELETE FROM barbers b
     WHERE NOT b.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements($1::jsonb->'barbers') x)
       AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.barber_id = b.id)`,
    [data],
  );
  await sql(
    `DELETE FROM services s
     WHERE NOT s.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements($1::jsonb->'services') x)`,
    [data],
  );

  const [counts] = await sql(
    `SELECT (SELECT count(*)::int FROM barbers) AS barbers,
            (SELECT count(*)::int FROM services WHERE active) AS services,
            (SELECT count(*)::int FROM appointments) AS appointments,
            (SELECT coalesce(sum(price), 0)::float8 FROM appointments) AS total`,
  );
  return Response.json(counts);
});
