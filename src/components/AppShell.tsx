import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, BarChart3, Settings, Scissors, LogOut } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LOGIN_OFF, meQuery } from "@/lib/auth";
import { brl, PAYMENT_LABELS, type PaymentMethod } from "@/lib/barber";

const allItems = [
  { to: "/", label: "Novo", icon: Plus, admin: false },
  { to: "/resumo", label: "Resumo", icon: BarChart3, admin: false },
  { to: "/ajustes", label: "Ajustes", icon: Settings, admin: true },
] as const;

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* sound not available */
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const items = allItems.filter((i) => !i.admin || me?.isAdmin);

  useEffect(() => {
    if (!me?.isAdmin) return;
    const channel = supabase
      .channel("admin-appointments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, (payload) => {
        const a = payload.new as { barber_name: string; service_name: string; price: number; payment_method: string; barber_id: string | null };
        qc.invalidateQueries({ queryKey: ["appointments"] });
        if (a.barber_id && a.barber_id === me.barber?.id) return;
        beep();
        toast(`✂️ ${a.barber_name}: ${a.service_name}`, {
          description: `${brl(Number(a.price))} · ${PAYMENT_LABELS[a.payment_method as PaymentMethod] ?? a.payment_method}`,
          duration: 8000,
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.isAdmin, me?.barber?.id, qc]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const who = LOGIN_OFF ? "" : me?.isAdmin ? "Admin" : me?.barber?.name ?? me?.email;

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border md:p-5 md:gap-1 md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary !text-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        {!LOGIN_OFF && <div className="mt-auto space-y-2 border-t border-border pt-4">
          <p className="truncate text-xs text-muted-foreground">{who}</p>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>}
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
          {!LOGIN_OFF && <button onClick={signOut} aria-label="Sair" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {who} <LogOut className="h-4 w-4" />
          </button>}
        </header>
        <main className="mx-auto w-full max-w-4xl px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground"
            activeProps={{ className: "!text-primary" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="pole h-8 w-3 rounded-full" aria-hidden />
      <span className="font-display text-lg font-semibold tracking-tight">Barbearia</span>
      <Scissors className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
