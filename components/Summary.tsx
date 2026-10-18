"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { brl, PAYMENT_LABELS, periodStart, splitPrice, summarize, type Appt, type PaymentMethod, type Period } from "@/lib/barber";
import { api, notifyChanged, useData } from "@/lib/client";
import { LoadError, Loading } from "./States";

const periods: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];

export function Summary({ period }: { period: Period }) {
  const since = useMemo(() => periodStart(period).toISOString(), [period]);
  const { data, error, reload } = useData<Appt[]>(`/api/appointments?since=${encodeURIComponent(since)}`);

  const remove = async (id: string) => {
    if (!confirm("Apagar este lançamento?")) return;
    try {
      await api(`/api/appointments/${id}`, { method: "DELETE" });
      toast.success("Lançamento apagado");
      notifyChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Resumo geral</h1>
        <div className="flex rounded-xl bg-secondary p-1">
          {periods.map((x) => (
            <Link
              key={x.id}
              href={x.id === "hoje" ? "/resumo" : `/resumo?p=${x.id}`}
              replace
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                period === x.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
              }`}
            >
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      {error ? <LoadError message={error} onRetry={reload} /> : !data ? <Loading /> : <Body data={data} onRemove={remove} />}
    </div>
  );
}

function Body({ data, onRemove }: { data: Appt[]; onRemove: (id: string) => void }) {
  const s = summarize(data);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total" value={brl(s.total)} sub={`${s.count} atendimentos`} />
        <Stat label="Barbearia (50%)" value={brl(s.shop)} accent />
        <div className="col-span-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 lg:col-span-1">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((k) => (
            <div key={k}>
              <p className="text-xs text-muted-foreground">{PAYMENT_LABELS[k]}</p>
              <p className="font-semibold">{brl(s.byPayment[k])}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Barbeiros</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(s.byBarber).map(([k, b]) => (
            <div key={k} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-medium">{b.name}</p>
              <p className="font-display text-2xl font-semibold">{brl(b.earned)}</p>
              <p className="text-xs text-muted-foreground">{b.count} cortes</p>
            </div>
          ))}
          {s.count === 0 && <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>}
        </div>
      </section>

      {data.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Lançamentos</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {a.service_name} · {a.barber_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {PAYMENT_LABELS[a.payment_method as PaymentMethod] ?? a.payment_method} · barbeiro{" "}
                    {brl(splitPrice(a.price).barber)}
                  </p>
                </div>
                <span className="font-semibold">{brl(a.price)}</span>
                <button
                  aria-label="Apagar"
                  onClick={() => onRemove(a.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
      <p className={`text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
