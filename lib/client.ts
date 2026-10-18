"use client";

import { useCallback, useEffect, useState } from "react";

const CHANGED = "barbearia:changed";

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Erro ${res.status}`);
  return data as T;
}

/** Avisa todas as telas abertas que os dados mudaram (elas recarregam sozinhas). */
export const notifyChanged = () => window.dispatchEvent(new Event(CHANGED));

export function useData<T>(url: string) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(url));
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [url]);

  useEffect(() => {
    setData(undefined);
    reload();
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload]);

  return { data, error, reload };
}

// Lançamentos feitos neste aparelho não disparam o aviso sonoro.
export const ownAppointments = new Set<string>();
