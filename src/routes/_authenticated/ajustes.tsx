import { createFileRoute, redirect } from "@tanstack/react-router";
import { BarberAccess } from "@/components/BarberAccess";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { barbersQuery, servicesQuery } from "@/lib/barber";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Barbearia" },
      { name: "description", content: "Edite os nomes dos barbeiros, serviços e preços." },
      { property: "og:title", content: "Ajustes — Barbearia" },
      { property: "og:description", content: "Edite barbeiros, serviços e preços." },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (!context.me?.isAdmin) throw redirect({ to: "/" });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(barbersQuery),
      context.queryClient.ensureQueryData(servicesQuery),
    ]),
  component: Settings,
  errorComponent: ({ error }) => <p className="text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
  notFoundComponent: () => <p>Não encontrado.</p>,
});

const input =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-primary";

function Settings() {
  const { data: barbers } = useSuspenseQuery(barbersQuery);
  const { data: services } = useSuspenseQuery(servicesQuery);
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const done = (key: string, msg = "Salvo") => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: [key] });
  };

  const renameBarber = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await supabase.from("barbers").update({ name: name.trim() }).eq("id", id);
    error ? toast.error(error.message) : done("barbers");
  };
  const updateService = async (id: string, patch: { name?: string; price?: number }) => {
    const { error } = await supabase.from("services").update(patch).eq("id", id);
    error ? toast.error(error.message) : done("services");
  };
  const removeService = async (id: string) => {
    if (!confirm("Remover este serviço?")) return;
    const { error } = await supabase.from("services").update({ active: false }).eq("id", id);
    error ? toast.error(error.message) : done("services", "Removido");
  };
  const addService = async () => {
    const price = Number(newPrice.replace(",", "."));
    if (!newName.trim() || !price) { toast.error("Preencha nome e preço"); return; }
    const { error } = await supabase.from("services").insert({ name: newName.trim(), price });
    if (error) { toast.error(error.message); return; }
    setNewName("");
    setNewPrice("");
    done("services", "Serviço adicionado");
  };

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Ajustes</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Barbeiros</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {barbers.map((b) => (
            <input
              key={b.id}
              defaultValue={b.name}
              className={input}
              onBlur={(e) => e.target.value !== b.name && renameBarber(b.id, e.target.value)}
            />
          ))}
        </div>
      </section>

      <BarberAccess barbers={barbers} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Serviços e preços (R$)
        </h2>
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex gap-2">
              <input
                defaultValue={s.name}
                className={input}
                onBlur={(e) => e.target.value !== s.name && e.target.value.trim() && updateService(s.id, { name: e.target.value.trim() })}
              />
              <input
                defaultValue={String(s.price)}
                inputMode="decimal"
                className={`${input} w-28`}
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  if (v && v !== Number(s.price)) updateService(s.id, { price: v });
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
            <button
              onClick={addService}
              aria-label="Adicionar"
              className="rounded-xl bg-primary px-3 text-primary-foreground"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
