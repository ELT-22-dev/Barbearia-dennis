import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  appointmentsQuery,
  brl,
  splitPrice,
  summarize,
  PAYMENT_LABELS,
  type PaymentMethod,
  type Period,
} from "@/lib/barber";
import { meQuery } from "@/lib/auth";

const periods: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];

export const Route = createFileRoute("/_authenticated/resumo")({
  validateSearch: (s: Record<string, unknown>): { p: Period } => ({
    p: s["p"] === "semana" || s["p"] === "mes" ? s["p"] : "hoje",
  }),
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(appointmentsQuery(deps.p)),
  head: () => ({
    meta: [
      { title: "Resumo — Barbearia" },
      { name: "description", content: "Ganhos de cada barbeiro, parte da barbearia e totais por pagamento." },
      { property: "og:title", content: "Resumo — Barbearia" },
      { property: "og:description", content: "Ganhos de cada barbeiro e da barbearia." },
    ],
  }),
  component: Summary,
  errorComponent: ({ error }) => <p className="text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
  notFoundComponent: () => <p>Não encontrado.</p>,
});

function Summary() {
  const { p } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(appointmentsQuery(p));
  const s = summarize(data);
  const { data: me } = useSuspenseQuery(meQuery);
  const isAdmin = !!me?.isAdmin;
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento apagado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{isAdmin ? "Resumo geral" : "Meus cortes"}</h1>
        <div className="flex rounded-xl bg-secondary p-1">
          {periods.map((x) => (
            <button
              key={x.id}
              onClick={() => navigate({ search: { p: x.id } })}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                p === x.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total" value={brl(s.total)} sub={`${s.count} atendimentos`} />
        {isAdmin ? (
          <Stat label="Barbearia (50%)" value={brl(s.shop)} accent />
        ) : (
          <Stat label="Sua parte (50%)" value={brl(s.total - s.shop)} accent />
        )}
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
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Barbeiros</h2>
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
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Lançamentos</h2>
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
                    · {PAYMENT_LABELS[a.payment_method as PaymentMethod]} · barbeiro{" "}
                    {brl(splitPrice(Number(a.price)).barber)}
                  </p>
                </div>
                <span className="font-semibold">{brl(Number(a.price))}</span>
                <button
                  aria-label="Apagar"
                  onClick={() => confirm("Apagar este lançamento?") && remove.mutate(a.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${accent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
    >
      <p className={`text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
