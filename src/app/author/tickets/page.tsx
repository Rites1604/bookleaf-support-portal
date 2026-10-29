"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { TicketDto } from "@/lib/types";
import { useTicketEvents } from "@/lib/useTicketEvents";
import { EmptyState, LiveDot, StatusBadge, timeAgo } from "@/components/ui";

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketDto[] | null>(null);
  const [updated, setUpdated] = useState<Set<string>>(new Set());

  const load = useCallback(() => api<TicketDto[]>("/tickets?sort=newest").then(setTickets), []);
  useEffect(() => {
    load();
  }, [load]);

  const live = useTicketEvents((ids) => {
    setUpdated((prev) => new Set([...prev, ...ids]));
    load();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Tickets</h1>
        <div className="flex items-center gap-4">
          <LiveDot live={live} />
          <Link href="/author/tickets/new" className="btn-primary">New ticket</Link>
        </div>
      </div>

      {!tickets ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <EmptyState title="You haven't raised any tickets">
          If something isn’t right with a book, a payout or your account, <Link href="/author/tickets/new" className="text-brand-700 underline">let us know</Link>.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/author/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {t.subject}
                    {updated.has(t.id) && <span className="ml-2 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Updated</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.book?.title ?? "General / Account"} · opened {timeAgo(t.createdAt)} · {t._count?.messages ?? 0} repl{t._count?.messages === 1 ? "y" : "ies"}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
