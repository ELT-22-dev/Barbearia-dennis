"use client";

import { Banknote, CreditCard, QrCode } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { brl, PAYMENT_LABELS, splitPrice, type Appt, type Barber, type PaymentMethod, type Service } from "@/lib/barber";
import type { Me } from "@/lib/auth";
import { api, notifyChanged, ownAppointments, useData } from "@/lib/client";
import { LoadError, Loading } from "./States";

const payIcons = { dinheiro: Banknote, pix: QrCode, cartao: CreditCard };

export function NewAppointment({ me }: { me: Me }) {
  const isAdmin = me.role === "admin";
  // Barbeiro só anota corte próprio: a API devolve só ele e já vem selecionado.
  const barbers = useData<Barber[]>("/api/barbers");
  const services = useData<Service[]>("/api/services");
  const [barberId, setBarberId] = useState<string | null>(isAdmin ? null : me.id);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);

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

  const barber = barbers.data.find((b) => b.id === barberId);
  const service = services.data.find((s) => s.id === serviceId);
  const price = service?.price ?? 0;
  const split = splitPrice(price);
  const ready = barber && service && payment;

  const save = async () => {
    if (!barber || !service || !payment) return;
    setSaving(true);
    try {
      const created = await api<Appt>("/api/appointments", {
        method: "POST",
        body: { barber_id: barber.id, service_id: service.id, payment_method: payment },
      });
      ownAppointments.add(created.id);
      toast.success(`Registrado: ${brl(splitPrice(created.price).barber)} para ${created.barber_name}`);
      setServiceId(null);
      setPayment(null);
      notifyChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Novo atendimento</h1>

      <Step n={1} title="Barbeiro">
        <div className="grid grid-cols-3 gap-3">
          {barbers.data.map((b) => (
            <Choice key={b.id} active={b.id === barberId} onClick={() => setBarberId(b.id)}>
              <span className="text-base font-semibold">{b.name}</span>
            </Choice>
          ))}
        </div>
      </Step>

      <Step n={2} title="Serviço">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.data.map((s) => (
            <Choice key={s.id} active={s.id === serviceId} onClick={() => setServiceId(s.id)}>
              <span className="font-medium">{s.name}</span>
              <span className="font-display text-xl font-semibold">{brl(s.price)}</span>
            </Choice>
          ))}
          {services.data.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Nenhum serviço. Cadastre em Ajustes.</p>
          )}
        </div>
      </Step>

      <Step n={3} title="Pagamento">
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => {
            const Icon = payIcons[p];
            return (
              <Choice key={p} active={p === payment} onClick={() => setPayment(p)}>
                <Icon className="h-5 w-5" />
                <span className="font-medium">{PAYMENT_LABELS[p]}</span>
              </Choice>
            );
          })}
        </div>
      </Step>

      <div className="sticky bottom-20 rounded-2xl border border-border bg-card p-4 shadow-soft md:bottom-6">
        <div className="mb-3 flex justify-between text-sm text-muted-foreground">
          <span>
            {isAdmin ? "Barbeiro" : "Sua parte"} <strong className="text-foreground">{brl(split.barber)}</strong>
          </span>
          <span>
            Barbearia <strong className="text-foreground">{brl(split.shop)}</strong>
          </span>
        </div>
        <button
          disabled={!ready || saving}
          onClick={save}
          className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {saving ? "Salvando..." : `Registrar ${price ? brl(price) : ""}`}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium tracking-wider text-muted-foreground uppercase">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-foreground">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all active:scale-[0.98] ${
        active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}
