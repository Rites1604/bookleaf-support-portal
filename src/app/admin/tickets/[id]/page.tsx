"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import type { BookDto, DraftDto, TicketDto } from "@/lib/types";
import { useTicketEvents } from "@/lib/useTicketEvents";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, STATUSES, STATUS_LABEL, inr, type Status } from "@/lib/domain";
import { CategoryBadge, EmptyState, LiveDot, PriorityBadge, SlaChip, fmtDate } from "@/components/ui";
import { Conversation } from "@/components/Conversation";

const AI_REASON_TEXT: Record<string, string> = {
  not_configured: "AI drafting is switched off (no API key configured). Write the reply below.",
  rate_limited: "The AI provider is rate-limiting us right now. Write the reply manually or try Regenerate in a minute.",
  timeout: "The AI provider took too long to respond. Write the reply manually or try Regenerate.",
  provider_error: "The AI provider returned an error. Write the reply manually or try Regenerate.",
  bad_output: "The AI returned an unusable draft. Write the reply manually or try Regenerate.",
  refused: "The AI declined to draft this one. Please write the reply manually.",
};

export default function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<TicketDto | null>(null);
  const [books, setBooks] = useState<BookDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => api<TicketDto>(`/tickets/${id}`).then(setTicket).catch((e) => setError(e instanceof ApiClientError ? e.message : "Could not load ticket")),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (ticket?.author.id) api<BookDto[]>(`/books?authorId=${ticket.author.id}`).then(setBooks).catch(() => setBooks([]));
  }, [ticket?.author.id]);
  const live = useTicketEvents((ids) => ids.includes(id) && load());

  async function patch(body: Record<string, unknown>) {
    try {
      await api(`/tickets/${id}`, { method: "PATCH", json: body });
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Update failed");
    }
  }

  async function reclassify() {
    await api(`/tickets/${id}/classify`, { method: "POST" });
    await load();
  }

  if (error && !ticket) return <EmptyState title="Ticket not available">{error}</EmptyState>;
  if (!ticket) return <p className="text-sm text-slate-500">Loading…</p>;

  const book = books.find((b) => b.id === ticket.book?.id);

  return (
    <div className="space-y-4">
      <Link href="/admin/tickets" className="text-sm text-teal-700 hover:underline">← Queue</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <p className="text-sm text-slate-500">
            {ticket.author.user.name} ({ticket.author.authorCode}) · {ticket.book?.title ?? "General / Account Level"} · opened {fmtDate(ticket.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SlaChip createdAt={ticket.createdAt} status={ticket.status} />
          <LiveDot live={live} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Conversation ticket={ticket} viewer="ADMIN" />
          <Composer ticket={ticket} onSent={load} onStatus={(status) => patch({ status })} />
        </div>

        <aside className="space-y-4">
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Triage</h2>
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={ticket.priority} source={ticket.prioritySource} />
              <CategoryBadge category={ticket.category} source={ticket.categorySource} />
            </div>
            {ticket.aiReasoning && (
              <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium">Why: </span>
                {ticket.aiReasoning}
                {ticket.aiConfidence != null && ` (confidence ${Math.round(ticket.aiConfidence * 100)}%)`}
              </p>
            )}
            <Select label="Status" value={ticket.status} onChange={(v) => patch({ status: v })} options={STATUSES.map((s) => [s, STATUS_LABEL[s]])} />
            <Select
              label="Category"
              value={ticket.category}
              onChange={(v) => patch({ category: v })}
              options={[...(ticket.category === "UNCLASSIFIED" ? [["UNCLASSIFIED", "Classifying…"] as [string, string]] : []), ...CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])]}
            />
            <Select label="Priority" value={ticket.priority} onChange={(v) => patch({ priority: v })} options={PRIORITIES.map((p) => [p, p.charAt(0) + p.slice(1).toLowerCase()])} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Assignee: {ticket.assignee?.name ?? "Unassigned"}</span>
              {ticket.assignee ? (
                <button className="text-xs text-teal-700 hover:underline" onClick={() => patch({ assigneeId: null })}>Unassign</button>
              ) : (
                <button className="btn-secondary" onClick={() => patch({ assigneeId: "me" })}>Assign to me</button>
              )}
            </div>
            {(ticket.categorySource === "FALLBACK" || ticket.prioritySource === "FALLBACK") && (
              <button className="text-xs text-teal-700 hover:underline" onClick={reclassify}>Re-run AI classification</button>
            )}
          </section>

          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">Author</h2>
            <p>{ticket.author.user.name}</p>
            <p className="text-slate-500">{ticket.author.user.email}</p>
            {books.length > 0 && <p className="text-xs text-slate-500">{books.length} book{books.length > 1 ? "s" : ""} with BookLeaf</p>}
          </section>

          {book && <BookFacts book={book} />}
        </aside>
      </div>
    </div>
  );
}

/** The record an agent would otherwise look up in another tool before replying. */
function BookFacts({ book }: { book: BookDto }) {
  const rows: [string, string][] = book.inProduction
    ? [["Stage", book.productionStage ?? book.status], ["ISBN", book.isbn]]
    : [
        ["ISBN", book.isbn],
        ["Published", fmtDate(book.publicationDate)],
        ["MRP / royalty per copy", `${inr(book.mrp)} / ${inr(book.royaltyPerCopy)}`],
        ["Copies sold", book.copiesSold.toLocaleString("en-IN")],
        ["Earned / paid", `${inr(book.royaltyEarned)} / ${inr(book.royaltyPaid)}`],
        ["Pending", inr(book.royaltyPending)],
        ["Last payout", book.lastPayoutDate ? fmtDate(book.lastPayoutDate) : "Never"],
        ["Print partner", book.printPartner ?? "—"],
        ["Listed on", book.availableOn.join(", ") || "—"],
      ];
  return (
    <section className="card p-4 text-sm">
      <h2 className="mb-2 font-semibold">{book.title}</h2>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {book.royalty?.likelyOverdue && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">Payout looks overdue under the quarterly + 45-day policy.</p>}
      {book.royalty?.belowThreshold && <p className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-600">Pending is below the ₹1,000 payout threshold (rolls over).</p>}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select className="input py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Composer({ ticket, onSent, onStatus }: { ticket: TicketDto; onSent: () => Promise<unknown>; onStatus: (s: Status) => Promise<void> }) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState<DraftDto | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [usedDraftId, setUsedDraftId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  // The draft is cached server-side against the ticket's current state, so this is free after the first load.
  const fetchDraft = useCallback(
    async (regenerate = false) => {
      setDrafting(true);
      try {
        const d = await api<DraftDto>(`/tickets/${ticket.id}/draft`, { method: regenerate ? "POST" : "GET" });
        setDraft(d);
        if (d.status === "ready" && (!touched.current || regenerate)) {
          setBody(d.draft.body);
          setUsedDraftId(d.draft.id);
          touched.current = false;
        }
      } catch {
        setDraft({ status: "unavailable", reason: "provider_error" });
      } finally {
        setDrafting(false);
      }
    },
    [ticket.id],
  );

  const lastAuthorMessage = [...(ticket.messages ?? [])].reverse().find((m) => !m.isInternal)?.sender.role;
  const needsReply = ticket.status !== "CLOSED" && lastAuthorMessage !== "ADMIN";
  const messageCount = ticket.messages?.length ?? 0;
  useEffect(() => {
    if (needsReply && ticket.category !== "UNCLASSIFIED") fetchDraft();
    // Re-draft when the conversation grows (new author message) or classification lands.
  }, [needsReply, ticket.category, messageCount, fetchDraft]);

  async function send(resolve = false) {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/tickets/${ticket.id}/messages`, {
        method: "POST",
        json: { body, isInternal: mode === "note", draftId: mode === "reply" ? usedDraftId : undefined },
      });
      if (resolve) await onStatus("RESOLVED");
      setBody("");
      setUsedDraftId(undefined);
      touched.current = false;
      await onSent();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-1 border-b border-slate-100 pb-3 text-sm">
        <button className={`rounded px-3 py-1 ${mode === "reply" ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600"}`} onClick={() => setMode("reply")}>
          Reply to author
        </button>
        <button className={`rounded px-3 py-1 ${mode === "note" ? "bg-yellow-50 font-medium text-yellow-800" : "text-slate-600"}`} onClick={() => setMode("note")}>
          Internal note
        </button>
        {mode === "reply" && (
          <div className="ml-auto flex items-center gap-3 text-xs">
            {drafting && <span className="text-slate-500">Drafting with AI…</span>}
            {draft?.status === "ready" && !drafting && (
              <span className="text-slate-400">
                AI draft · {draft.draft.model}
                {draft.draft.cached ? " · cached" : ""}
              </span>
            )}
            <button className="text-teal-700 hover:underline disabled:opacity-50" disabled={drafting || ticket.category === "UNCLASSIFIED"} onClick={() => fetchDraft(true)}>
              {draft?.status === "ready" ? "Regenerate" : "Draft with AI"}
            </button>
          </div>
        )}
      </div>

      {mode === "reply" && draft?.status === "unavailable" && !drafting && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{AI_REASON_TEXT[draft.reason] ?? AI_REASON_TEXT.provider_error}</p>
      )}
      {mode === "reply" && ticket.category === "UNCLASSIFIED" && (
        <p className="mb-3 text-xs text-slate-500">Waiting for classification before drafting…</p>
      )}

      <textarea
        className={`input min-h-56 ${mode === "note" ? "bg-yellow-50/50" : ""}`}
        value={body}
        onChange={(e) => {
          touched.current = true;
          setBody(e.target.value);
        }}
        placeholder={mode === "note" ? "Visible to the BookLeaf team only" : "Reply to the author"}
      />
      {usedDraftId && mode === "reply" && <p className="mt-1 text-xs text-slate-400">Started from the AI draft. Review the numbers and promises before sending.</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {mode === "reply" ? (
          <>
            <button className="btn-secondary" disabled={busy || !body.trim()} onClick={() => send(true)}>Send &amp; resolve</button>
            <button className="btn-primary" disabled={busy || !body.trim()} onClick={() => send()}>{busy ? "Sending…" : "Send reply"}</button>
          </>
        ) : (
          <button className="btn-primary bg-yellow-600 hover:bg-yellow-700" disabled={busy || !body.trim()} onClick={() => send()}>Add note</button>
        )}
      </div>
    </div>
  );
}
