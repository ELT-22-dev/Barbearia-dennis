export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* corpo inválido */
  }
  throw new HttpError(400, "Corpo da requisição inválido");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(v: unknown, what = "id"): string {
  if (typeof v === "string" && UUID.test(v)) return v;
  throw new HttpError(400, `${what} inválido`);
}

export function text(v: unknown, what: string, max = 80): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new HttpError(400, `Preencha ${what}`);
  if (s.length > max) throw new HttpError(400, `${what} muito longo`);
  return s;
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Erro no servidor. Tente de novo." }, { status: 500 });
    }
  };
}

export type IdContext = { params: Promise<{ id: string }> };
