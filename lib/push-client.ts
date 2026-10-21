"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

// on: este aparelho recebe | off: pode ativar | denied: bloqueado no navegador
// ios-install: iPhone fora da tela de início (a Apple só libera push no app instalado)
// unsupported: navegador sem push | unconfigured: servidor sem chaves VAPID
export type PushState = "loading" | "on" | "off" | "denied" | "ios-install" | "unsupported" | "unconfigured";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

const subscriptionBody = (sub: PushSubscription, confirm: boolean) => ({ ...sub.toJSON(), confirm });

// Aviso do topo e seção de Ajustes usam o hook ao mesmo tempo: um avisa o outro.
const CHANGED = "barbearia:push-changed";

export function usePush(vapidKey: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const set = (s: PushState) => !cancelled && setState(s);
    const check = async () => {
      if (!vapidKey) return set("unconfigured");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return set(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return set("denied");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          // Garante que o servidor tem esta assinatura (sem notificação de teste).
          await api("/api/push", { method: "POST", body: subscriptionBody(sub, false) }).catch(() => {});
          return set("on");
        }
        set("off");
      } catch {
        set("unsupported");
      }
    };
    void check();
    const onChange = () => void check();
    window.addEventListener(CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED, onChange);
    };
  }, [vapidKey]);

  const enable = useCallback(async () => {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      await api("/api/push", { method: "POST", body: subscriptionBody(sub, true) });
      setState("on");
      window.dispatchEvent(new Event(CHANGED));
    } finally {
      setBusy(false);
    }
  }, [vapidKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      window.dispatchEvent(new Event(CHANGED));
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
