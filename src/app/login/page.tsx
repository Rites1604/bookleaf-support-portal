"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { Logo } from "@/components/Logo";

// Shown on the login page because this is a demo build reviewers need to get into quickly.
const DEMO_ACCOUNTS = [
  { label: "Author · Priya Sharma (2 books, pending royalty)", email: "priya.sharma@email.com" },
  { label: "Author · Kavita Deshmukh (book in production)", email: "kavita.deshmukh@email.com" },
  { label: "Author · Ananya Reddy (never paid)", email: "ananya.reddy@email.com" },
  { label: "Admin · Support Admin", email: "admin@bookleaf.in" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: { role: string } }>("/auth/login", { method: "POST", json: { email, password } });
      const home = user.role === "ADMIN" ? "/admin/tickets" : "/author/books";
      const allowed = next && next.startsWith(user.role === "ADMIN" ? "/admin" : "/author");
      router.replace(allowed ? next : home);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    // Soft pink wash like the bookleafpub.com hero.
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-sm">
        <Logo size={44} />
        <h1 className="mb-6 mt-5 text-2xl font-light text-ink">Author Support Portal</h1>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>

        <div className="mt-6 text-xs text-slate-500">
          <p className="mb-2 font-medium text-slate-600">Demo accounts (password in README)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button type="button" className="text-left text-brand-700 hover:underline" onClick={() => setEmail(a.email)}>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
