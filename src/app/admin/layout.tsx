import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/server/auth/currentSession";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      portal="Operations"
      userName={session.name}
      nav={[
        { href: "/admin/tickets", label: "Ticket Queue" },
        { href: "/admin/ai-usage", label: "AI Usage" },
      ]}
    >
      {children}
    </AppShell>
  );
}
