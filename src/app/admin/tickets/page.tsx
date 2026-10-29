"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { TicketDto } from "@/lib/types";
import { useTicketEvents } from "@/lib/useTicketEvents";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, STATUSES, STATUS_LABEL } from "@/lib/domain";
import { CategoryBadge, EmptyState, LiveDot, PriorityBadge, SlaChip, StatusBadge, timeAgo } from "@/components/ui";

type Filters = { status: string; category: string; priority: string; assignee: string; from: string; to: string; q: string; sort: string };
const DEFAULTS: Filters = { status: "", category: "", priority: "", assignee: "", from: "", to: "", q: "", sort: "urgency" };

export default function TicketQueuePage() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [tickets, setTickets] = useState<TicketDto[] | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filters]);

  // The quick-filter counts come from the unfiltered queue so they don't change as filters are applied.
  const [all, setAll] = useState<TicketDto[]>([]);
  const load = useCallback(
    () => Promise.all([api<TicketDto[]>(`/tickets?${qs}`).then(setTickets), api<TicketDto[]>("/tickets").then(setAll)]),
    [qs],
  );
  useEffect(() => {
    load();
  }, [load]);

  const live = useTicketEvents((ids) => {
    setFresh((prev) => new Set([...prev, ...ids]));
    load();
  });

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const counts = useMemo(() => {
    const open = all.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
    return {
      open: open.length,
      critical: open.filter((t) => t.priority === "CRITICAL").length,
      review: open.filter((t) => t.categorySource === "FALLBACK" || t.prioritySource === "FALLBACK").length,
      unassigned: open.filter((t) => !t.assignee).length,
    };
  }, [all]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Ticket Queue</h1>
        <LiveDot live={live} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <QuickFilter label={`${counts.open} unresolved`} active={!filters.status && !filters.priority && !filters.assignee} onClick={() => setFilters(DEFAULTS)} />
        <QuickFilter label={`${counts.critical} critical`} active={filters.priority === "CRITICAL"} onClick={() => setFilters({ ...DEFAULTS, priority: "CRITICAL" })} tone="red" />
        <QuickFilter label={`${counts.unassigned} unassigned`} active={filters.assignee === "unassigned"} onClick={() => setFilters({ ...DEFAULTS, assignee: "unassigned" })} />
        <QuickFilter label="Assigned to me" active={filters.assignee === "me"} onClick={() => setFilters({ ...DEFAULTS, assignee: "me" })} />
        {counts.review > 0 && <span className="self-center text-xs text-amber-700">{counts.review} labelled by fallback rules: review when AI is back</span>}
      </div>

      <div className="card grid grid-cols-2 gap-2 p-3 md:grid-cols-4 lg:grid-cols-8">
        <input className="input col-span-2" placeholder="Search subject, text, author" value={filters.q} onChange={set("q")} />
        <select className="input" value={filters.status} onChange={set("status")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="input" value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select className="input" value={filters.priority} onChange={set("priority")}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
        </select>
        <input type="date" className="input" value={filters.from} onChange={set("from")} title="Created from" />
        <input type="date" className="input" value={filters.to} onChange={set("to")} title="Created to" />
        <select className="input" value={filters.sort} onChange={set("sort")}>
          <option value="urgency">Most urgent first</option>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {!tickets ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets match these filters" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Assignee</th>
                <th className="px-4 py-2 text-right">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className={`hover:bg-slate-50 ${t.priority === "CRITICAL" && t.status !== "RESOLVED" && t.status !== "CLOSED" ? "bg-red-50/40" : ""}`}>
                  <td className="max-w-md px-4 py-3">
                    <Link href={`/admin/tickets/${t.id}`} className="font-medium hover:text-teal-700">
                      {t.subject}
                    </Link>
                    {fresh.has(t.id) && <span className="ml-2 h-2 w-2 rounded-full bg-teal-500 align-middle inline-block" title="Updated since you opened the queue" />}
                    <p className="truncate text-xs text-slate-500">
                      {t.author.user.name} · {t.book?.title ?? "Account level"}
                    </p>
                  </td>
                  <td className="px-2 py-3"><PriorityBadge priority={t.priority} source={t.prioritySource} /></td>
                  <td className="px-2 py-3"><CategoryBadge category={t.category} source={t.categorySource} /></td>
                  <td className="px-2 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-2 py-3 text-xs text-slate-600">{t.assignee?.name ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-slate-500">{timeAgo(t.createdAt)}</span>
                      <SlaChip createdAt={t.createdAt} status={t.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuickFilter({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: "red" }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${active ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"} ${tone === "red" && !active ? "text-red-700" : ""}`}
    >
      {label}
    </button>
  );
}
