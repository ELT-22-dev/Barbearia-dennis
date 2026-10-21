// Notificações push (Web Push / VAPID) para o administrador.
import { after } from "next/server";
import webpush from "web-push";
import { sql } from "./db";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;
const configured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidSet = false;
function setup() {
  if (vapidSet) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://barbearia-dennis-eosin.vercel.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidSet = true;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

async function send(subs: Sub[], msg: PushMessage) {
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), {
          TTL: 24 * 60 * 60,
          urgency: "high",
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Aparelho desinscrito ou app desinstalado: some da lista.
        if (status === 404 || status === 410) await sql(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
        else console.error("Falha ao enviar push", status, err);
      }
    }),
  );
}

/** Envia depois de responder, para não atrasar quem registrou o corte. */
function schedule(task: () => Promise<void>) {
  const run = () => task().catch((err) => console.error("Falha nas notificações", err));
  try {
    after(run);
  } catch {
    void run(); // fora de uma requisição (testes)
  }
}

export function notifyAdmins(msg: PushMessage) {
  if (!configured()) return;
  setup();
  schedule(async () => {
    const subs = await sql<Sub>(
      `SELECT s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
       JOIN barbers b ON b.id = s.barber_id
       WHERE b.role = 'admin' AND b.password_hash IS NOT NULL`,
    );
    await send(subs, msg);
  });
}

export function notifyDevice(sub: Sub, msg: PushMessage) {
  if (!configured()) return;
  setup();
  schedule(() => send([sub], msg));
}
