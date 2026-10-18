import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setupAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Barbearia" },
      { name: "description", content: "Acesso dos barbeiros e do administrador da barbearia." },
      { property: "og:title", content: "Entrar — Barbearia" },
      { property: "og:description", content: "Acesso dos barbeiros e do administrador." },
    ],
  }),
  component: AuthPage,
});

const input =
  "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-primary";

function AuthPage() {
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setup = useServerFn(setupAdmin);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "setup") await setup({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("E-mail ou senha incorretos");
      qc.clear();
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div className="flex items-center gap-2">
          <span className="pole h-8 w-3 rounded-full" aria-hidden />
          <span className="font-display text-2xl font-semibold tracking-tight">Barbearia</span>
        </div>
        <h1 className="font-display text-xl font-semibold">
          {mode === "login" ? "Entrar" : "Primeiro acesso do administrador"}
        </h1>
        <input className={input} type="email" placeholder="E-mail" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className={input}
          type="password"
          placeholder={mode === "setup" ? "Crie sua senha (mín. 6)" : "Senha"}
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar senha e entrar"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "setup" : "login")}
          className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Sou o administrador e é meu primeiro acesso" : "Já tenho conta — entrar"}
        </button>
      </form>
    </div>
  );
}
