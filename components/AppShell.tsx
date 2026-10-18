"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Plus, Scissors, Settings } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { brl, PAYMENT_LABELS, type Appt, type PaymentMethod } from "@/lib/barber";
import { api, notifyChanged, ownAppointments } from "@/lib/client";

const items = [
  { href: "/", label: "Novo", icon: Plus },
  { href: "/resumo", label: "Resumo", icon: BarChart3 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

const POLL_MS = 15_000;

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
    /* som indisponível */
  }
}

// Avisa (som + toast) quando outro aparelho registra um atendimento.
function useNewAppointmentAlerts() {
  useEffect(() => {
    let after: string | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        if (after === null) {
          const [latest] = await api<Appt[]>("/api/appointments?limit=1");
          after = latest?.created_at ?? new Date(0).toISOString();
        } else if (document.visibilityState === "visible") {
          const fresh = await api<Appt[]>(`/api/appointments?after=${encodeURIComponent(after)}`);
          if (fresh.length) {
            after = fresh[0]!.created_at;
            const others = fresh.filter((a) => !ownAppointments.has(a.id));
            for (const a of others.reverse()) {
              toast(`✂️ ${a.barber_name}: ${a.service_name}`, {
                description: `${brl(a.price)} · ${PAYMENT_LABELS[a.payment_method as PaymentMethod] ?? a.payment_method}`,
                duration: 8000,
              });
            }
            if (others.length) {
              beep();
              notifyChanged();
            }
          }
        }
      } catch {
        /* sem conexão: tenta de novo no próximo ciclo */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useNewAppointmentAlerts();

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:gap-1 md:border-r md:border-border md:p-5">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
                pathname === href ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
        </header>
        <main className="mx-auto w-full max-w-4xl px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              pathname === href ? "text-primary" : "text-muted-foreground"
            }`}
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
