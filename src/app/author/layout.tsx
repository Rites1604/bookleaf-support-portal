import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/server/auth/currentSession";

export default async function AuthorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      portal="Author"
      userName={session.name}
      nav={[
        { href: "/author/books", label: "My Books" },
        { href: "/author/tickets", label: "My Tickets" },
        { href: "/author/tickets/new", label: "Get Help" },
      ]}
    >
      {children}
    </AppShell>
  );
}
