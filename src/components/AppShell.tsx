"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Logo } from "./Logo";

type NavItem = { href: string; label: string };

export function AppShell({ nav, userName, portal, children }: { nav: NavItem[]; userName: string; portal: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo height={40} />
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">{portal}</span>
          </div>
          <nav className="flex gap-1">
            {nav.map((n) => {
              const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href + "/"));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-brand-50 font-medium text-brand-800" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">{userName}</span>
            <button onClick={logout} className="btn-secondary">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
