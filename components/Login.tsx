"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";

export type LoginOption = { id: string; name: string; role: "admin" | "barber"; has_access: boolean };

const input = "w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-primary";

export function Login({ options }: { options: LoginOption[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = options.find((o) => o.id === selectedId);
  const admin = options.find((o) => o.role === "admin");
  // Admin sem senha ainda: o primeiro acesso é pelo código de recuperação.
  const recoverMode = selected?.role === "admin" && (recovering || !selected.has_access);

  const choose = (id: string) => {
    setSelectedId(id);
    setRecovering(false);
    setPassword("");
    setCode("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      if (recoverMode) await api("/api/auth/recover", { method: "POST", body: { code, password } });
      else await api("/api/auth/login", { method: "POST", body: { barber_id: selected.id, password } });
      window.location.replace("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <span className="pole h-8 w-3 rounded-full" aria-hidden />
          <span className="font-display text-2xl font-semibold tracking-tight">Barbearia</span>
        </div>

        <section className="space-y-3">
          <h1 className="font-display text-xl font-semibold">Quem é você?</h1>
          <div className="grid grid-cols-3 gap-3">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                aria-pressed={o.id === selectedId}
                className={`min-h-16 rounded-2xl border p-3 text-center font-semibold transition-all active:scale-[0.98] ${
                  o.id === selectedId
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card hover:border-foreground/30"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </section>

        {selected && !selected.has_access && selected.role !== "admin" && (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Seu acesso ainda não foi liberado. Peça ao {admin?.name ?? "administrador"} para criar sua senha.
          </p>
        )}

        {selected && (selected.has_access || selected.role === "admin") && (
          <section className="space-y-3">
            {recoverMode && (
              <>
                <p className="text-sm text-muted-foreground">
                  {selected.has_access ? "Esqueceu a senha?" : "Primeiro acesso."} Digite o código de acesso do administrador
                  e crie uma senha nova.
                </p>
                <input
                  className={input}
                  placeholder="Código de acesso"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </>
            )}
            <input
              className={input}
              type="password"
              placeholder={recoverMode ? "Nova senha (mín. 4)" : "Senha"}
              autoComplete={recoverMode ? "new-password" : "current-password"}
              required
              minLength={recoverMode ? 4 : undefined}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Aguarde..." : recoverMode ? "Salvar senha e entrar" : "Entrar"}
            </button>
            {selected.role === "admin" && selected.has_access && (
              <button
                type="button"
                onClick={() => setRecovering(!recovering)}
                className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {recovering ? "Lembrei a senha — entrar" : "Esqueci minha senha"}
              </button>
            )}
          </section>
        )}
      </form>
    </div>
  );
}
