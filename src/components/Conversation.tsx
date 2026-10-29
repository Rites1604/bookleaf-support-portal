import type { MessageDto, TicketDto } from "@/lib/types";
import { fmtDate, timeAgo } from "./ui";

/** Original query followed by the thread. Admins also see internal notes, styled distinctly. */
export function Conversation({ ticket, viewer }: { ticket: TicketDto; viewer: "AUTHOR" | "ADMIN" }) {
  return (
    <div className="space-y-3">
      <Bubble
        who={viewer === "AUTHOR" ? "You" : ticket.author.user.name}
        at={ticket.createdAt}
        tone="author"
        body={ticket.description}
        footer={ticket.attachmentName ? `Attachment: ${ticket.attachmentName}` : undefined}
      />
      {ticket.messages?.map((m) => <MessageBubble key={m.id} m={m} viewer={viewer} />)}
    </div>
  );
}

function MessageBubble({ m, viewer }: { m: MessageDto; viewer: "AUTHOR" | "ADMIN" }) {
  if (m.isInternal) return <Bubble who={`${m.sender.name} · internal note`} at={m.createdAt} tone="internal" body={m.body} />;
  const fromSupport = m.sender.role === "ADMIN";
  const who = fromSupport ? (viewer === "AUTHOR" ? `BookLeaf Support (${m.sender.name})` : m.sender.name) : viewer === "AUTHOR" ? "You" : m.sender.name;
  return (
    <Bubble
      who={who}
      at={m.createdAt}
      tone={fromSupport ? "support" : "author"}
      body={m.body}
      footer={viewer === "ADMIN" && m.fromAiDraft ? "Sent from AI draft" : undefined}
    />
  );
}

const TONES = {
  author: "bg-white border-slate-200",
  support: "bg-brand-50 border-brand-200",
  internal: "bg-yellow-50 border-yellow-300 border-dashed",
};

function Bubble({ who, at, body, tone, footer }: { who: string; at: string; body: string; tone: keyof typeof TONES; footer?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${TONES[tone]}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{who}</span>
        <span title={fmtDate(at)}>{timeAgo(at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      {footer && <p className="mt-2 text-xs text-slate-400">{footer}</p>}
    </div>
  );
}
