"use client";

import { Bell, BellOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePush, type PushState } from "@/lib/push-client";

const DISMISS_KEY = "barbearia:push-banner-dismissed";

const help: Partial<Record<PushState, string>> = {
  "ios-install":
    "No iPhone, as notificações só funcionam com o app na Tela de Início: toque em Compartilhar → “Adicionar à Tela de Início” e abra o app por lá.",
  denied: "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e recarregue a página.",
  unsupported: "Este navegador não recebe notificações. Use o Chrome, o Edge, o Safari ou o app instalado no celular.",
  unconfigured: "As notificações ainda não foram configuradas no servidor.",
};

function useToggle(vapidKey: string | null) {
  const push = usePush(vapidKey);
  const enable = () =>
    push.enable().catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível ativar as notificações"));
  return { ...push, enable };
}

/** Faixa no topo para o administrador ativar as notificações neste aparelho. */
export function NotificationsBanner({ vapidKey }: { vapidKey: string | null }) {
  const { state, busy, enable } = useToggle(vapidKey);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed || (state !== "off" && state !== "ios-install")) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sem armazenamento: só esconde agora */
    }
  };

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Bell className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">Receba uma notificação a cada corte registrado.</p>
        {state === "ios-install" ? (
          <p className="text-sm text-muted-foreground">{help["ios-install"]}</p>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Ativando..." : "Ativar neste aparelho"}
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Fechar" className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Seção em Ajustes. */
export function NotificationsSettings({ vapidKey }: { vapidKey: string | null }) {
  const { state, busy, enable, disable } = useToggle(vapidKey);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium tracking-wider text-muted-foreground uppercase">Notificações</h2>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Avisa você quando o Eddy ou o Júnior registram, corrigem ou apagam um corte. Ative em cada aparelho onde quer
          receber (celular, computador).
        </p>
        {state === "loading" && <p className="text-sm text-muted-foreground">Verificando...</p>}
        {state === "on" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4" /> Ativadas neste aparelho
            </span>
            <button
              onClick={disable}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
            >
              <BellOff className="h-4 w-4" /> Desativar
            </button>
          </div>
        )}
        {state === "off" && (
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Ativando..." : "Ativar neste aparelho"}
          </button>
        )}
        {help[state] && <p className="text-sm">{help[state]}</p>}
      </div>
    </section>
  );
}
