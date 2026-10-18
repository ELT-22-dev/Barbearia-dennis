import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LOGIN_OFF = true;

export const ADMIN_EMAIL = "zulmazerna2020@gmail.com";

export const isAdminEmail = (email: string) => email.trim().toLowerCase() === ADMIN_EMAIL;

export type Me = {
  id: string;
  email: string;
  isAdmin: boolean;
  barber: { id: string; name: string } | null;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    // Login temporarily off: open, full access for everyone.
    if (LOGIN_OFF) return { id: "", email: "", isAdmin: true, barber: null };
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const [roles, barber] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("barbers").select("id, name").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      id: user.id,
      email: user.email ?? "",
      isAdmin: !!roles.data?.some((r) => r.role === "admin"),
      barber: barber.data ?? null,
    };
  },
});
