// Fluxo completo das API routes contra um Postgres real (PGlite em memória).
import { describe, expect, it } from "vitest";
import * as appointments from "@/app/api/appointments/route";
import * as appointment from "@/app/api/appointments/[id]/route";
import * as barbers from "@/app/api/barbers/route";
import * as barber from "@/app/api/barbers/[id]/route";
import * as services from "@/app/api/services/route";
import * as service from "@/app/api/services/[id]/route";
import type { Appt, Barber, Service } from "@/lib/barber";

const url = (path: string) => `http://test${path}`;
const json = (method: string, body: unknown) =>
  ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as RequestInit;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function call<T>(res: Promise<Response>, status = 200): Promise<T> {
  const r = await res;
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBe(status);
  return body as T;
}

describe("API", () => {
  it("cria dados iniciais uma única vez", async () => {
    const bs = await call<Barber[]>(barbers.GET());
    expect(bs.map((b) => b.name)).toEqual(["Barbeiro 1", "Barbeiro 2", "Barbeiro 3"]);
    const ss = await call<Service[]>(services.GET());
    expect(ss).toEqual([
      expect.objectContaining({ name: "Corte", price: 30 }),
      expect.objectContaining({ name: "Corte simples", price: 25 }),
    ]);
  });

  it("renomeia barbeiro e edita/adiciona/remove serviço", async () => {
    const [b1] = await call<Barber[]>(barbers.GET());
    await call(barber.PATCH(new Request(url(""), json("PATCH", { name: "Dennis" })), ctx(b1!.id)));
    expect((await call<Barber[]>(barbers.GET()))[0]!.name).toBe("Dennis");

    const barba = await call<Service>(services.POST(new Request(url(""), json("POST", { name: "Barba", price: "20,5" }))), 201);
    expect(barba.price).toBe(20.5);
    await call(service.PATCH(new Request(url(""), json("PATCH", { price: 22 })), ctx(barba.id)));
    await call(service.DELETE(new Request(url("")), ctx(barba.id)));
    const names = (await call<Service[]>(services.GET())).map((s) => s.name);
    expect(names).not.toContain("Barba");
  });

  it("recusa entradas inválidas", async () => {
    await call(services.POST(new Request(url(""), json("POST", { name: "X", price: 0 }))), 400);
    await call(barber.PATCH(new Request(url(""), json("PATCH", { name: "  " })), ctx(crypto.randomUUID())), 400);
    await call(barber.PATCH(new Request(url(""), json("PATCH", { name: "A" })), ctx("nao-e-uuid")), 400);
    const [b] = await call<Barber[]>(barbers.GET());
    const [s] = await call<Service[]>(services.GET());
    await call(
      appointments.POST(new Request(url(""), json("POST", { barber_id: b!.id, service_id: s!.id, payment_method: "cheque" }))),
      400,
    );
    await call(
      appointments.POST(
        new Request(url(""), json("POST", { barber_id: b!.id, service_id: crypto.randomUUID(), payment_method: "pix" })),
      ),
      404,
    );
  });

  it("registra atendimento com preço do banco, lista por período e apaga", async () => {
    const [b] = await call<Barber[]>(barbers.GET());
    const [corte] = await call<Service[]>(services.GET());
    const before = new Date(Date.now() - 1000).toISOString();

    const created = await call<Appt>(
      appointments.POST(
        new Request(url(""), json("POST", { barber_id: b!.id, service_id: corte!.id, payment_method: "pix", price: 1 })),
      ),
      201,
    );
    expect(created).toMatchObject({ barber_name: "Dennis", service_name: "Corte", price: 30, payment_method: "pix" });
    expect(created.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const list = await call<Appt[]>(appointments.GET(new Request(url(`/api/appointments?since=${before}`))));
    expect(list.map((a) => a.id)).toContain(created.id);

    // "after" com o próprio created_at não devolve o mesmo lançamento de novo
    const after = await call<Appt[]>(
      appointments.GET(new Request(url(`/api/appointments?after=${encodeURIComponent(created.created_at)}`))),
    );
    expect(after).toEqual([]);

    const future = new Date(Date.now() + 60_000).toISOString();
    expect(await call<Appt[]>(appointments.GET(new Request(url(`/api/appointments?since=${future}`))))).toEqual([]);

    await call(appointment.DELETE(new Request(url("")), ctx(created.id)));
    await call(appointment.DELETE(new Request(url("")), ctx(created.id)), 404);
  });
});
