"use client";

import { Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Me } from "@/lib/auth";
import {
  brl,
  PAYMENT_LABELS,
  periodStart,
  splitPrice,
  summarize,
  type Appt,
  type Barber,
  type PaymentMethod,
  type Period,
  type Service,
} from "@/lib/barber";
import { api, notifyChanged, useData } from "@/lib/client";
import { LoadError, Loading } from "./States";

const periods: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];

export function Summary({ me, period }: { me: Me; period: Period }) {
  const isAdmin = me.role === "admin";
  const since = useMemo(() => periodStart(period).toISOString(), [period]);
  // A API já filtra: barbeiro recebe só os próprios lançamentos.
  const { data, error, reload } = useData<Appt[]>(`/api/appointments?since=${encodeURIComponent(since)}`);
  const [editing, setEditing] = useState<Appt | null>(null);

  const remove = async (a: Appt) => {
    if (!confirm(`Apagar ${a.service_name} de ${a.barber_name}?`)) return;
    try {
      await api(`/api/appointments/${a.id}`, { method: "DELETE" });
      toast.success("Lançamento apagado");
      notifyChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{isAdmin ? "Resumo geral" : "Meus cortes"}</h1>
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

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <Body data={data} isAdmin={isAdmin} onEdit={setEditing} onRemove={remove} />
      )}

      {editing && <EditAppointment appt={editing} isAdmin={isAdmin} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Body({
  data,
  isAdmin,
  onEdit,
  onRemove,
}: {
  data: Appt[];
  isAdmin: boolean;
  onEdit: (a: Appt) => void;
  onRemove: (a: Appt) => void;
}) {
  const s = summarize(data);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total" value={brl(s.total)} sub={`${s.count} atendimentos`} />
        {isAdmin ? (
          <Stat label="Barbearia (50%)" value={brl(s.shop)} accent />
        ) : (
          <Stat label="Sua parte (50%)" value={brl(s.total - s.shop)} accent />
        )}
        {/* celular: 3 colunas; desktop (card estreito): uma linha por forma de pagamento */}
        <div className="col-span-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 lg:col-span-1 lg:grid-cols-1 lg:content-center lg:gap-1.5">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((k) => (
            <div key={k} className="lg:flex lg:items-baseline lg:justify-between">
              <p className="text-xs text-muted-foreground lg:text-sm">{PAYMENT_LABELS[k]}</p>
              <p className="font-semibold">{brl(s.byPayment[k])}</p>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
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
          </div>
        </section>
      )}

      {s.count === 0 && <p className="text-sm text-muted-foreground">Nenhum atendimento neste período.</p>}

      {data.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Lançamentos</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-3 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{isAdmin ? `${a.service_name} · ${a.barber_name}` : a.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {PAYMENT_LABELS[a.payment_method as PaymentMethod] ?? a.payment_method} · {isAdmin ? "barbeiro" : "sua parte"}{" "}
                    {brl(splitPrice(a.price).barber)}
                  </p>
                </div>
                <span className="font-semibold">{brl(a.price)}</span>
                <button
                  aria-label="Corrigir"
                  onClick={() => onEdit(a)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  aria-label="Apagar"
                  onClick={() => onRemove(a)}
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

/** Corrigir um lançamento: serviço e pagamento (o admin também troca o barbeiro). */
function EditAppointment({ appt, isAdmin, onClose }: { appt: Appt; isAdmin: boolean; onClose: () => void }) {
  const services = useData<Service[]>("/api/services");
  const barbers = useData<Barber[]>("/api/barbers");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>(appt.payment_method as PaymentMethod);
  const [barberId, setBarberId] = useState<string | null>(appt.barber_id);
  const [saving, setSaving] = useState(false);

  // Serviço atual pré-selecionado pelo nome (o lançamento guarda nome e preço, não o id).
  const current = services.data?.find((s) => s.name === appt.service_name && s.price === appt.price);
  const selectedService = serviceId ?? current?.id ?? null;

  const save = async () => {
    const body: Record<string, string> = {};
    if (selectedService && selectedService !== current?.id) body.service_id = selectedService;
    if (payment !== appt.payment_method) body.payment_method = payment;
    if (isAdmin && barberId && barberId !== appt.barber_id) body.barber_id = barberId;
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    try {
      await api(`/api/appointments/${appt.id}`, { method: "PATCH", body });
      toast.success("Corte corrigido");
      notifyChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-2xl border p-3 text-center transition-all active:scale-[0.98] ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30"
    }`;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Corrigir corte"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Corrigir corte</h2>
            <p className="text-sm text-muted-foreground">
              {appt.service_name} · {brl(appt.price)} ·{" "}
              {new Date(appt.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isAdmin && barbers.data && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Barbeiro</h3>
            <div className="grid grid-cols-3 gap-2">
              {barbers.data.map((b) => (
                <button key={b.id} type="button" onClick={() => setBarberId(b.id)} aria-pressed={b.id === barberId} className={chip(b.id === barberId)}>
                  <span className="font-semibold">{b.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Serviço</h3>
          {!services.data ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {services.data.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  aria-pressed={s.id === selectedService}
                  className={`flex flex-col ${chip(s.id === selectedService)}`}
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="font-display font-semibold">{brl(s.price)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => (
              <button key={p} type="button" onClick={() => setPayment(p)} aria-pressed={p === payment} className={chip(p === payment)}>
                <span className="text-sm font-medium">{PAYMENT_LABELS[p]}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar correção"}
        </button>
      </div>
    </div>
  );
}
