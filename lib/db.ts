import { neon } from "@neondatabase/serverless";

type Row = Record<string, unknown>;
type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

// Produção: Neon (DATABASE_URL vem das variáveis de ambiente da Vercel).
// Desenvolvimento/testes sem DATABASE_URL: PGlite (Postgres em WASM) local.
async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    return (text, params = []) => sql.query(text, params) as Promise<Row[]>;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL não configurada");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(process.env.NODE_ENV === "test" ? undefined : ".pglite");
  return async (text, params = []) => (await db.query<Row>(text, params)).rows;
}

const SCHEMA_VERSION = "schema_v1";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS barbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    position int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL CHECK (price > 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // created_at truncado em milissegundos: o mesmo valor que o JSON devolve ao cliente,
  // para o filtro "after" do aviso de novos atendimentos ser exato.
  `CREATE TABLE IF NOT EXISTS appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL,
    barber_name text NOT NULL,
    service_name text NOT NULL,
    price numeric(10,2) NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('dinheiro','pix','cartao')),
    created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds', now())
  )`,
  `CREATE INDEX IF NOT EXISTS appointments_created_at_idx ON appointments (created_at DESC)`,
  // Dados iniciais exatamente uma vez, mesmo com várias instâncias subindo juntas.
  `WITH seed AS (
    INSERT INTO app_meta (key) VALUES ('seed_v1') ON CONFLICT DO NOTHING RETURNING 1
  ), b AS (
    INSERT INTO barbers (name, position)
    SELECT v.name, v.position FROM (VALUES ('Barbeiro 1', 1), ('Barbeiro 2', 2), ('Barbeiro 3', 3)) AS v(name, position)
    WHERE EXISTS (SELECT 1 FROM seed)
    RETURNING 1
  )
  INSERT INTO services (name, price)
  SELECT v.name, v.price FROM (VALUES ('Corte', 30.00), ('Corte simples', 25.00)) AS v(name, price)
  WHERE EXISTS (SELECT 1 FROM seed)`,
  `INSERT INTO app_meta (key) VALUES ('${SCHEMA_VERSION}') ON CONFLICT DO NOTHING`,
];

async function migrate(query: Query) {
  try {
    const done = await query(`SELECT 1 FROM app_meta WHERE key = $1`, [SCHEMA_VERSION]);
    if (done.length) return;
  } catch {
    // app_meta ainda não existe: banco novo.
  }
  for (const statement of SCHEMA) await query(statement);
}

const g = globalThis as unknown as { __barbeariaDb?: Promise<Query> };

function ready(): Promise<Query> {
  g.__barbeariaDb ??= connect()
    .then(async (query) => {
      await migrate(query);
      return query;
    })
    .catch((err) => {
      g.__barbeariaDb = undefined;
      throw err;
    });
  return g.__barbeariaDb;
}

export async function sql<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const query = await ready();
  return (await query(text, params)) as T[];
}
