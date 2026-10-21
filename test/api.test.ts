// Fluxo completo das API routes contra um Postgres real (PGlite em memória),
// incluindo login e o que cada papel (admin x barbeiro) pode fazer.
import { beforeAll, describe, expect, it } from "vitest";
import * as appointments from "@/app/api/appointments/route";
import * as appointment from "@/app/api/appointments/[id]/route";
import * as login from "@/app/api/auth/login/route";
import * as recover from "@/app/api/auth/recover/route";
import * as barbers from "@/app/api/barbers/route";
import * as barber from "@/app/api/barbers/[id]/route";
import * as access from "@/app/api/barbers/[id]/access/route";
import * as services from "@/app/api/services/route";
import * as service from "@/app/api/services/[id]/route";
import type { Appt, Barber, Service } from "@/lib/barber";

const CODE = "codigo-de-teste";
process.env.ADMIN_RECOVERY_CODE = CODE;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(cookie?: string, method = "GET", body?: unknown, path = "/") {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function call<T>(res: Promise<Response>, status = 200): Promise<T> {
  const r = await res;
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBe(status);
  return body as T;
}
async function cookieOf(res: Promise<Response>) {
  const r = await res;
  expect(r.status, await r.clone().text()).toBe(200);
  return r.headers.get("set-cookie")!.split(";")[0]!;
}

let admin: string; // cookie do administrador
let ids: { admin: string; b2: string; b3: string };

beforeAll(async () => {
  // Primeiro acesso do admin pelo código de recuperação.
  admin = await cookieOf(recover.POST(req(undefined, "POST", { code: CODE, password: "dono1234" })));
  const list = await call<Barber[]>(barbers.GET(req(admin)));
  ids = { admin: list[0]!.id, b2: list[1]!.id, b3: list[2]!.id };
});

describe("login e acesso", () => {
  it("sem login nada abre", async () => {
    await call(barbers.GET(req()), 401);
    await call(services.GET(req()), 401);
    await call(appointments.GET(req(undefined, "GET", undefined, "/api/appointments")), 401);
    await call(appointments.POST(req("barbearia_session=lixo", "POST", {})), 401);
  });

  it("código de recuperação errado é recusado", async () => {
    await call(recover.POST(req(undefined, "POST", { code: "errado", password: "abcd" })), 401);
  });

  it("primeiro da lista é o admin e vê todos com a situação do acesso", async () => {
    const list = await call<Barber[]>(barbers.GET(req(admin)));
    expect(list.map((b) => [b.role, b.has_access])).toEqual([
      ["admin", true],
      ["barber", false],
      ["barber", false],
    ]);
  });

  it("barbeiro sem acesso não entra; admin dá acesso e ele entra", async () => {
    await call(login.POST(req(undefined, "POST", { barber_id: ids.b2, password: "1234" })), 403);
    await call(access.PUT(req(admin, "PUT", { password: "12" }), ctx(ids.b2)), 400);
    await call(access.PUT(req(admin, "PUT", { password: "1234" }), ctx(ids.b2)));
    await call(login.POST(req(undefined, "POST", { barber_id: ids.b2, password: "errada" })), 401);
    await cookieOf(login.POST(req(undefined, "POST", { barber_id: ids.b2, password: "1234" })));
  });

  it("5 senhas erradas bloqueiam o login por alguns minutos", async () => {
    await call(access.PUT(req(admin, "PUT", { password: "4321" }), ctx(ids.b3)));
    for (let i = 0; i < 5; i++) await call(login.POST(req(undefined, "POST", { barber_id: ids.b3, password: "x" })), 401);
    await call(login.POST(req(undefined, "POST", { barber_id: ids.b3, password: "4321" })), 429);
    // admin trocando a senha desbloqueia
    await call(access.PUT(req(admin, "PUT", { password: "4321" }), ctx(ids.b3)));
    await cookieOf(login.POST(req(undefined, "POST", { barber_id: ids.b3, password: "4321" })));
  });

  it("barbeiro só anota corte próprio e não vê nem edita nada", async () => {
    const eddy = await cookieOf(login.POST(req(undefined, "POST", { barber_id: ids.b2, password: "1234" })));
    const own = await call<Barber[]>(barbers.GET(req(eddy)));
    expect(own.map((b) => b.id)).toEqual([ids.b2]);
    expect(own[0]).not.toHaveProperty("has_access");

    const [corte] = await call<Service[]>(services.GET(req(eddy)));
    // tenta registrar em nome do admin: fica no nome dele mesmo
    const a = await call<Appt>(
      appointments.POST(req(eddy, "POST", { barber_id: ids.admin, service_id: corte!.id, payment_method: "pix" })),
      201,
    );
    expect(a.barber_id).toBe(ids.b2);

    await call(appointments.GET(req(eddy, "GET", undefined, "/api/appointments")), 403);
    await call(appointment.DELETE(req(eddy, "DELETE"), ctx(a.id)), 403);
    await call(service.PATCH(req(eddy, "PATCH", { price: 1 }), ctx(corte!.id)), 403);
    await call(services.POST(req(eddy, "POST", { name: "X", price: 10 })), 403);
    await call(barber.PATCH(req(eddy, "PATCH", { name: "Chefe" }), ctx(ids.b2)), 403);
    await call(access.PUT(req(eddy, "PUT", { password: "9999" }), ctx(ids.b2)), 403);
    await call(access.DELETE(req(eddy, "DELETE"), ctx(ids.b3)), 403);
  });

  it("remover acesso ou trocar senha derruba a sessão antiga", async () => {
    const s3 = await cookieOf(login.POST(req(undefined, "POST", { barber_id: ids.b3, password: "4321" })));
    await call(barbers.GET(req(s3)));
    await call(access.DELETE(req(admin, "DELETE"), ctx(ids.b3)));
    await call(barbers.GET(req(s3)), 401);
    await call(login.POST(req(undefined, "POST", { barber_id: ids.b3, password: "4321" })), 403);

    const s2 = await cookieOf(login.POST(req(undefined, "POST", { barber_id: ids.b2, password: "1234" })));
    await call(access.PUT(req(admin, "PUT", { password: "nova" }), ctx(ids.b2)));
    await call(barbers.GET(req(s2)), 401);
  });

  it("admin não remove o próprio acesso; trocar a própria senha mantém ele logado", async () => {
    await call(access.DELETE(req(admin, "DELETE"), ctx(ids.admin)), 400);
    const fresh = await cookieOf(access.PUT(req(admin, "PUT", { password: "dono5678" }), ctx(ids.admin)));
    await call(barbers.GET(req(admin)), 401); // sessão antiga caiu
    admin = fresh;
    await call(barbers.GET(req(admin)));
  });
});

describe("admin", () => {
  it("dados iniciais", async () => {
    const ss = await call<Service[]>(services.GET(req(admin)));
    expect(ss).toEqual([
      expect.objectContaining({ name: "Corte", price: 30 }),
      expect.objectContaining({ name: "Corte simples", price: 25 }),
    ]);
  });

  it("renomeia barbeiro e edita/adiciona/remove serviço", async () => {
    await call(barber.PATCH(req(admin, "PATCH", { name: "Dennis" }), ctx(ids.admin)));
    expect((await call<Barber[]>(barbers.GET(req(admin))))[0]!.name).toBe("Dennis");

    const barba = await call<Service>(services.POST(req(admin, "POST", { name: "Barba", price: "20,5" })), 201);
    expect(barba.price).toBe(20.5);
    await call(service.PATCH(req(admin, "PATCH", { price: 22 }), ctx(barba.id)));
    await call(service.DELETE(req(admin, "DELETE"), ctx(barba.id)));
    const names = (await call<Service[]>(services.GET(req(admin)))).map((s) => s.name);
    expect(names).not.toContain("Barba");
  });

  it("recusa entradas inválidas", async () => {
    await call(services.POST(req(admin, "POST", { name: "X", price: 0 })), 400);
    await call(barber.PATCH(req(admin, "PATCH", { name: "  " }), ctx(crypto.randomUUID())), 400);
    await call(barber.PATCH(req(admin, "PATCH", { name: "A" }), ctx("nao-e-uuid")), 400);
    const [s] = await call<Service[]>(services.GET(req(admin)));
    await call(appointments.POST(req(admin, "POST", { barber_id: ids.admin, service_id: s!.id, payment_method: "cheque" })), 400);
    await call(
      appointments.POST(req(admin, "POST", { barber_id: ids.admin, service_id: crypto.randomUUID(), payment_method: "pix" })),
      404,
    );
  });

  it("registra para qualquer barbeiro com preço do banco, lista por período e apaga", async () => {
    const [corte] = await call<Service[]>(services.GET(req(admin)));
    const before = new Date(Date.now() - 1000).toISOString();
    const created = await call<Appt>(
      appointments.POST(req(admin, "POST", { barber_id: ids.b3, service_id: corte!.id, payment_method: "pix", price: 1 })),
      201,
    );
    expect(created).toMatchObject({ barber_id: ids.b3, service_name: "Corte", price: 30, payment_method: "pix" });
    expect(created.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const list = await call<Appt[]>(appointments.GET(req(admin, "GET", undefined, `/api/appointments?since=${before}`)));
    expect(list.map((a) => a.id)).toContain(created.id);

    // "after" com o próprio created_at não devolve o mesmo lançamento de novo
    const after = await call<Appt[]>(
      appointments.GET(req(admin, "GET", undefined, `/api/appointments?after=${encodeURIComponent(created.created_at)}`)),
    );
    expect(after).toEqual([]);

    await call(appointment.DELETE(req(admin, "DELETE"), ctx(created.id)));
    await call(appointment.DELETE(req(admin, "DELETE"), ctx(created.id)), 404);
  });
});
