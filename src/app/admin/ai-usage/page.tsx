"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui";

type Usage = {
  aiEnabled: boolean;
  models: { classify: string; draft: string };
  byTask: { task: string; model: string; success: boolean; calls: number; inputTokens: number; outputTokens: number; cachedTokens: number; avgLatencyMs: number; estCostUsd: number | null }[];
  drafts: { sent: number; editedBeforeSending: number };
};

export default function AiUsagePage() {
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => {
    api<Usage>("/admin/ai-usage").then(setU);
  }, []);
  if (!u) return <p className="text-sm text-slate-500">Loading…</p>;

  const total = u.byTask.reduce((s, r) => s + (r.estCostUsd ?? 0), 0);
  const calls = u.byTask.reduce((s, r) => s + r.calls, 0);
  const failures = u.byTask.filter((r) => !r.success).reduce((s, r) => s + r.calls, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">AI Usage</h1>
      {!u.aiEnabled && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No ANTHROPIC_API_KEY is configured. Tickets are classified by keyword rules and replies are written manually.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="AI calls" value={calls.toString()} />
        <Tile label="Failed calls (fell back)" value={failures.toString()} />
        <Tile label="Estimated spend" value={`$${total.toFixed(4)}`} />
        <Tile
          label="AI drafts sent / edited first"
          value={`${u.drafts.sent} / ${u.drafts.editedBeforeSending}`}
        />
      </div>
      <p className="text-xs text-slate-500">
        Models: classification on <code>{u.models.classify}</code>, drafts on <code>{u.models.draft}</code>. Spend is an estimate from list prices.
      </p>

      {u.byTask.length === 0 ? (
        <EmptyState title="No AI calls yet">Raise a ticket as an author or open one as an admin to see usage here.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500">
              <tr>
                {["Task", "Model", "Result", "Calls", "Input tok", "Cached tok", "Output tok", "Avg latency", "Est. cost"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {u.byTask.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.task}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
                  <td className="px-3 py-2">{r.success ? "ok" : "failed"}</td>
                  <td className="px-3 py-2">{r.calls}</td>
                  <td className="px-3 py-2">{r.inputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.cachedTokens.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.outputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.avgLatencyMs} ms</td>
                  <td className="px-3 py-2">{r.estCostUsd == null ? "—" : `$${r.estCostUsd.toFixed(4)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
