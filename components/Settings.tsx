"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parsePrice, type Barber, type Service } from "@/lib/barber";
import { api, notifyChanged, useData } from "@/lib/client";
import { LoadError, Loading } from "./States";

const input = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-primary";

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

export function Settings() {
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
        <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Serviços e preços (R$)</h2>
        <div className="space-y-2">
          {services.data.map((s) => (
            <div key={`${s.id}:${s.name}:${s.price}`} className="flex gap-2">
              <input
                aria-label="Nome do serviço"
                defaultValue={s.name}
                className={input}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) updateService(s.id, { name: v });
                }}
              />
              <input
                aria-label="Preço"
                defaultValue={String(s.price).replace(".", ",")}
                inputMode="decimal"
                className={`${input} w-28`}
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
            <input placeholder="Novo serviço" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} />
            <input
              placeholder="Preço"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className={`${input} w-28`}
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
