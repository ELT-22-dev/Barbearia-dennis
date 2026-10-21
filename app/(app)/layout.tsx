import { AppShell } from "@/components/AppShell";
import { requirePageUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePageUser();
  return <AppShell me={me}>{children}</AppShell>;
}
