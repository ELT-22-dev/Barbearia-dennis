import { sql } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const rows = await sql(`SELECT id, name, position FROM barbers ORDER BY position, created_at`);
  return Response.json(rows);
});
