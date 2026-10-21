import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// Admin vê todos (com situação do acesso); barbeiro só a si mesmo.
export const GET = handle(async (req: Request) => {
  const me = await requireUser(req);
  const rows =
    me.role === "admin"
      ? await sql(
          `SELECT id, name, position, role, password_hash IS NOT NULL AS has_access
           FROM barbers ORDER BY position, created_at`,
        )
      : await sql(`SELECT id, name, position FROM barbers WHERE id = $1`, [me.id]);
  return Response.json(rows);
});
