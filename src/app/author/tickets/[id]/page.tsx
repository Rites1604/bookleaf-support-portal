"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import type { TicketDto } from "@/lib/types";
import { useTicketEvents } from "@/lib/useTicketEvents";
import { EmptyState, LiveDot, StatusBadge, fmtDate } from "@/components/ui";
import { Conversation } from "@/components/Conversation";

export default function AuthorTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<TicketDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api<TicketDto>(`/tickets/${id}`).then(setTicket).catch((e) => setError(e instanceof ApiClientError ? e.message : "Could not load ticket")),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  const live = useTicketEvents((ids) => ids.includes(id) && load());

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/tickets/${id}/messages`, { method: "POST", json: { body: reply } });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  if (error && !ticket) return <EmptyState title="Ticket not available">{error}</EmptyState>;
  if (!ticket) return <p className="text-sm text-slate-500">Loading…</p>;

  const awaitingReply = !ticket.messages?.length;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/author/tickets" className="text-sm text-brand-700 hover:underline">← All tickets</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <p className="text-sm text-slate-500">
            {ticket.book?.title ?? "General / Account Level"} · opened {fmtDate(ticket.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot live={live} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <Conversation ticket={ticket} viewer="AUTHOR" />

      {awaitingReply && (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Our team has your ticket. Replies appear here automatically; you don’t need to refresh.
        </p>
      )}

      {ticket.status === "CLOSED" ? (
        <p className="text-sm text-slate-500">
          This ticket is closed. <Link href="/author/tickets/new" className="text-brand-700 underline">Raise a new ticket</Link> if you need more help.
        </p>
      ) : (
        <form onSubmit={send} className="card space-y-3 p-4">
          <label className="label" htmlFor="reply">Add a reply</label>
          <textarea id="reply" className="input min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add more detail or answer the team's question" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
