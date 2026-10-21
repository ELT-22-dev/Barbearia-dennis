"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parsePrice, type Barber, type Service } from "@/lib/barber";
import type { Me } from "@/lib/auth";
import { api, notifyChanged, useData } from "@/lib/client";
import { NotificationsSettings } from "./Notifications";
import { LoadError, Loading } from "./States";

const field = "rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-primary";
const input = `w-full ${field}`;
const nameInput = `min-w-0 flex-1 ${field}`;
const priceInput = `w-24 shrink-0 ${field}`;

async function run(action: Promise<unknown>, msg = "Salvo") {
  try {
    await action;
    toast.success(msg);
    notifyChanged();
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    return false;
  }
}

export function Settings({ me, vapidKey }: { me: Me; vapidKey: string | null }) {
  const barbers = useData<Barber[]>("/api/barbers");
  const services = useData<Service[]>("/api/services");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const error = barbers.error ?? services.error;
  if (error)
    return (
      <LoadError
        message={error}
        onRetry={() => {
          barbers.reload();
          services.reload();
        }}
      />
    );
  if (!barbers.data || !services.data) return <Loading />;

  const renameBarber = (id: string, name: string) =>
    name.trim() && run(api(`/api/barbers/${id}`, { method: "PATCH", body: { name: name.trim() } }));

  const updateService = (id: string, patch: { name?: string; price?: number }) =>
    run(api(`/api/services/${id}`, { method: "PATCH", body: patch }));

  const removeService = (id: string) =>
    confirm("Remover este serviço?") && run(api(`/api/services/${id}`, { method: "DELETE" }), "Removido");

  const addService = async () => {
    const price = parsePrice(newPrice);
    if (!newName.trim() || price === null) {
      toast.error("Preencha nome e preço");
      return;
    }
    if (await run(api("/api/services", { method: "POST", body: { name: newName.trim(), price } }), "Serviço adicionado")) {
      setNewName("");
      setNewPrice("");
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Ajustes</h1>

      <NotificationsSettings vapidKey={vapidKey} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Barbeiros</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {barbers.data.map((b) => (
            <input
              key={`${b.id}:${b.name}`}
              aria-label={`Nome de ${b.name}`}
              defaultValue={b.name}
              className={input}
              onBlur={(e) => e.target.value.trim() !== b.name && renameBarber(b.id, e.target.value)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Acesso</h2>
        <p className="text-sm text-muted-foreground">
          Quem tem acesso entra com o próprio nome e senha e só consegue anotar os próprios cortes.
        </p>
        <div className="space-y-3">
          {barbers.data.map((b) => (
            <AccessRow key={`${b.id}:${b.has_access}`} barber={b} isSelf={b.id === me.id} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Serviços e preços (R$)</h2>
        <div className="space-y-2">
          {services.data.map((s) => (
            <div key={`${s.id}:${s.name}:${s.price}`} className="flex gap-2">
              <input
                aria-label="Nome do serviço"
                defaultValue={s.name}
                className={nameInput}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) updateService(s.id, { name: v });
                }}
              />
              <input
                aria-label="Preço"
                defaultValue={String(s.price).replace(".", ",")}
                inputMode="decimal"
                className={priceInput}
                onBlur={(e) => {
                  const v = parsePrice(e.target.value);
                  if (v !== null && v !== s.price) updateService(s.id, { price: v });
                }}
              />
              <button
                aria-label="Remover"
                onClick={() => removeService(s.id)}
                className="rounded-xl px-3 text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input placeholder="Novo serviço" value={newName} onChange={(e) => setNewName(e.target.value)} className={nameInput} />
            <input
              placeholder="Preço"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className={priceInput}
            />
            <button onClick={addService} aria-label="Adicionar" className="rounded-xl bg-primary px-3 text-primary-foreground">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AccessRow({ barber, isSelf }: { barber: Barber; isSelf: boolean }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const status = barber.role === "admin" ? "Administrador" : barber.has_access ? "Com acesso" : "Sem acesso";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      toast.error("A senha precisa ter pelo menos 4 caracteres");
      return;
    }
    setBusy(true);
    const msg = isSelf ? "Sua senha foi trocada" : `Senha salva. Passe a senha para ${barber.name}.`;
    if (await run(api(`/api/barbers/${barber.id}/access`, { method: "PUT", body: { password } }), msg)) setPassword("");
    setBusy(false);
  };

  const revoke = async () => {
    if (!confirm(`Remover o acesso de ${barber.name}? Ele sai do app na hora.`)) return;
    setBusy(true);
    await run(api(`/api/barbers/${barber.id}/access`, { method: "DELETE" }), "Acesso removido");
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          {barber.name}
          {isSelf && <span className="text-muted-foreground"> (você)</span>}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            barber.has_access ? "bg-secondary text-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          {status}
        </span>
      </div>
      <form onSubmit={save} className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label={`Nova senha de ${barber.name}`}
          type={isSelf ? "password" : "text"}
          autoComplete={isSelf ? "new-password" : "off"}
          placeholder={isSelf ? "Nova senha (mín. 4)" : "Senha (mín. 4)"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full min-w-0 sm:w-auto sm:flex-1 ${field}`}
        />
        <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {isSelf ? "Trocar minha senha" : barber.has_access ? "Trocar senha" : "Dar acesso"}
        </button>
        {!isSelf && barber.has_access && (
          <button
            type="button"
            disabled={busy}
            onClick={revoke}
            className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"
          >
            Remover acesso
          </button>
        )}
      </form>
    </div>
  );
}
