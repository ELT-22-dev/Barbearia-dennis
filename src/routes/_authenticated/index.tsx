import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  barbersQuery,
  servicesQuery,
  brl,
  splitPrice,
  PAYMENT_LABELS,
  type PaymentMethod,
} from "@/lib/barber";
import { meQuery } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Novo atendimento — Barbearia" },
      { name: "description", content: "Registre cortes, forma de pagamento e veja a divisão 50/50 na hora." },
      { property: "og:title", content: "Novo atendimento — Barbearia" },
      { property: "og:description", content: "Registre cortes e veja a divisão 50/50 na hora." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(barbersQuery),
      context.queryClient.ensureQueryData(servicesQuery),
    ]),
  component: NewAppointment,
  errorComponent: ({ error }) => <p className="text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
  notFoundComponent: () => <p>Não encontrado.</p>,
});

const payIcons = { dinheiro: Banknote, pix: QrCode, cartao: CreditCard };

function NewAppointment() {
  const { data: barbers } = useSuspenseQuery(barbersQuery);
  const { data: services } = useSuspenseQuery(servicesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [barberId, setBarberId] = useState<string | null>(me?.isAdmin ? null : me?.barber?.id ?? null);
  const visibleBarbers = me?.isAdmin ? barbers : barbers.filter((b) => b.id === me?.barber?.id);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);

  const barber = barbers.find((b) => b.id === barberId);
  const service = services.find((s) => s.id === serviceId);
  const price = service ? Number(service.price) : 0;
  const split = splitPrice(price);
  const ready = barber && service && payment;

  const save = useMutation({
    mutationFn: async () => {
      if (!barber || !service || !payment) return;
      const { error } = await supabase.from("appointments").insert({
        barber_id: barber.id,
        barber_name: barber.name,
        service_name: service.name,
        price,
        payment_method: payment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Registrado: ${brl(split.barber)} para ${barber?.name}`);
      setServiceId(null);
      setPayment(null);
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Novo atendimento</h1>

      {!me?.isAdmin && !me?.barber && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Sua conta ainda não está ligada a um barbeiro. Peça ao administrador.
        </p>
      )}
      <Step n={1} title="Barbeiro">
        <div className="grid grid-cols-3 gap-3">
          {visibleBarbers.map((b) => (
            <Choice key={b.id} active={b.id === barberId} onClick={() => setBarberId(b.id)}>
              <span className="text-base font-semibold">{b.name}</span>
            </Choice>
          ))}
        </div>
      </Step>

      <Step n={2} title="Serviço">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.map((s) => (
            <Choice key={s.id} active={s.id === serviceId} onClick={() => setServiceId(s.id)}>
              <span className="font-medium">{s.name}</span>
              <span className="font-display text-xl font-semibold">{brl(Number(s.price))}</span>
            </Choice>
          ))}
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
            Barbeiro <strong className="text-foreground">{brl(split.barber)}</strong>
          </span>
          <span>
            Barbearia <strong className="text-foreground">{brl(split.shop)}</strong>
          </span>
        </div>
        <button
          disabled={!ready || save.isPending}
          onClick={() => save.mutate()}
          className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {save.isPending ? "Salvando..." : `Registrar ${price ? brl(price) : ""}`}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-foreground">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all active:scale-[0.98] ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}
