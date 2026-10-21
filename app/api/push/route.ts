// Liga/desliga as notificações deste aparelho (só o administrador recebe).
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";
import { notifyDevice } from "@/lib/push";

function endpointOf(v: unknown) {
  if (typeof v !== "string" || v.length > 1000 || !v.startsWith("https://")) throw new HttpError(400, "Assinatura inválida");
  return v;
}
const key = (v: unknown) => {
  if (typeof v !== "string" || !v || v.length > 200) throw new HttpError(400, "Assinatura inválida");
  return v;
};

// { endpoint, keys: { p256dh, auth }, confirm? } — confirm manda uma notificação de teste.
export const POST = handle(async (req: Request) => {
  const me = await requireUser(req, "admin");
  const body = await readJson(req);
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const sub = { endpoint: endpointOf(body.endpoint), p256dh: key(keys.p256dh), auth: key(keys.auth) };
  await sql(
    `INSERT INTO push_subscriptions (endpoint, barber_id, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET barber_id = EXCLUDED.barber_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, me.id, sub.p256dh, sub.auth],
  );
  if (body.confirm === true) {
    notifyDevice(sub, { title: "🔔 Notificações ativadas", body: "Você vai ser avisado de cada corte registrado.", url: "/resumo" });
  }
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireUser(req, "admin");
  const body = await readJson(req);
  await sql(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND barber_id = $2`, [endpointOf(body.endpoint), me.id]);
  return Response.json({ ok: true });
});
