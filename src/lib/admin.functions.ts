import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "./auth";

const checkPassword = (p: unknown) => {
  if (typeof p !== "string" || p.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres");
  return p;
};

// First access: only the admin email can create its own account, and only once.
export const setupAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: { email: string; password: string }) => ({
    email: String(i.email ?? "").trim().toLowerCase(),
    password: checkPassword(i.password),
  }))
  .handler(async ({ data }) => {
    if (!isAdminEmail(data.email)) throw new Error("Este e-mail não é o do administrador");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (count) throw new Error("O administrador já tem conta. Use Entrar.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar a conta");
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const createBarberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { barberId: string; email: string; password: string }) => ({
    barberId: String(i.barberId),
    email: String(i.email ?? "").trim().toLowerCase(),
    password: checkPassword(i.password),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas o administrador pode criar acessos");
    if (!data.email.includes("@")) throw new Error("E-mail inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar a conta");
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "barber" });
    const { error: bErr } = await supabaseAdmin
      .from("barbers")
      .update({ user_id: uid, email: data.email })
      .eq("id", data.barberId);
    if (bErr) throw new Error(bErr.message);
    return { ok: true };
  });
