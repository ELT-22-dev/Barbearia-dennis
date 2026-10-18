import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createBarberAccount } from "@/lib/admin.functions";
import { LOGIN_OFF, meQuery } from "@/lib/auth";

type B = { id: string; name: string; user_id: string | null; email: string | null };

const input =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-primary";

export function BarberAccess({ barbers }: { barbers: B[] }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["barbers"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  if (LOGIN_OFF) return null;
  const linkSelf = async (id: string) => {
    if (!me) return;
    const { error } = await supabase.from("barbers").update({ user_id: me.id, email: me.email }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Você agora é este barbeiro");
      refresh();
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Acesso dos barbeiros</h2>
      <div className="space-y-3">
        {barbers.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-medium">{b.name}</p>
            {b.user_id ? (
              <p className="text-sm text-muted-foreground">
                {b.user_id === me?.id ? "Você (administrador)" : `Acesso: ${b.email ?? "criado"}`}
              </p>
            ) : (
              <NewAccess barber={b} onDone={refresh} onSelf={!me?.barber ? () => linkSelf(b.id) : undefined} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function NewAccess({ barber, onDone, onSelf }: { barber: B; onDone: () => void; onSelf?: (() => void) | undefined }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createBarberAccount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { barberId: barber.id, email, password } });
      toast.success(`Acesso criado para ${barber.name}. Passe o e-mail e a senha para ele.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input className={input} type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} type="text" placeholder="Senha (mín. 6)" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? "..." : "Criar acesso"}
      </button>
      {onSelf && (
        <button type="button" onClick={onSelf} className="text-left text-sm text-muted-foreground underline-offset-4 hover:underline sm:col-span-3">
          Este barbeiro sou eu
        </button>
      )}
    </form>
  );
}
