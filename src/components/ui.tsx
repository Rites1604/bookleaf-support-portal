import { CATEGORY_LABEL, SLA_HOURS, STATUS_LABEL, type Priority, type Status } from "@/lib/domain";
import type { LabelSource } from "@/lib/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Badge({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  OPEN: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-200 text-slate-700",
};
export const StatusBadge = ({ status }: { status: Status }) => <Badge className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Badge>;

const PRIORITY_STYLE: Record<Priority, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-slate-100 text-slate-700",
  LOW: "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
};
export const PriorityBadge = ({ priority, source }: { priority: Priority; source?: LabelSource }) => (
  <Badge className={PRIORITY_STYLE[priority]} title={source ? sourceTitle(source) : undefined}>
    {priority.charAt(0) + priority.slice(1).toLowerCase()}
    {source && <SourceMark source={source} />}
  </Badge>
);

export const CategoryBadge = ({ category, source }: { category: keyof typeof CATEGORY_LABEL; source?: LabelSource }) => (
  <Badge className="bg-indigo-50 text-indigo-800" title={source ? sourceTitle(source) : undefined}>
    {CATEGORY_LABEL[category]}
    {source && <SourceMark source={source} />}
  </Badge>
);

function sourceTitle(s: LabelSource) {
  return {
    PENDING: "Waiting for AI classification",
    AI: "Set by AI",
    FALLBACK: "Set by keyword rules (AI unavailable): please review",
    ADMIN: "Set by an admin",
  }[s];
}

/** Tiny marker so admins can see at a glance who set a label. */
function SourceMark({ source }: { source: LabelSource }) {
  if (source === "AI") return <span className="text-[10px] opacity-70">· AI</span>;
  if (source === "FALLBACK") return <span className="text-[10px] font-semibold text-amber-700">· review</span>;
  if (source === "PENDING") return <span className="text-[10px] opacity-70">· …</span>;
  return null;
}

export function SlaChip({ createdAt, status }: { createdAt: string; status: Status }) {
  if (status === "RESOLVED" || status === "CLOSED") return null;
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < SLA_HOURS * 0.75) return null;
  const breached = hours >= SLA_HOURS;
  return (
    <Badge className={breached ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}>
      {breached ? `SLA breached · ${Math.floor(hours)}h` : `${Math.floor(SLA_HOURS - hours)}h to SLA`}
    </Badge>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={live ? "Receiving live updates" : "Reconnecting…"}>
      <span className={cx("h-2 w-2 rounded-full", live ? "bg-emerald-500" : "bg-slate-300")} />
      {live ? "Live" : "Connecting"}
    </span>
  );
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
