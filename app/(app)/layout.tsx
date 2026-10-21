import { AppShell } from "@/components/AppShell";
import { vapidPublicKey } from "@/lib/push";
import { requirePageUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePageUser();
  return (
    <AppShell me={me} vapidKey={me.role === "admin" ? vapidPublicKey() : null}>
      {children}
    </AppShell>
  );
}
