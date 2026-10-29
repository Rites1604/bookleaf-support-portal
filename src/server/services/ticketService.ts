import { Prisma, type TicketStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Session } from "@/server/auth/session";
import { ApiError, forbidden, notFound } from "@/server/http/errors";
import { classifyTicket } from "@/server/ai/classifier";
import { draftCacheKey, generateDraft } from "@/server/ai/drafter";
import { aiEnabled } from "@/server/ai/client";
import type { DraftContext } from "@/server/ai/prompts/draft";
import type { Category } from "@/lib/domain";
import type {
  CreateMessageInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from "@/lib/validation";

const listInclude = {
  book: { select: { id: true, title: true, status: true } },
  author: { select: { id: true, authorCode: true, user: { select: { name: true, email: true } } } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.TicketInclude;

/** Authors are always scoped to their own tickets; admins see everything. */
function scopeFor(session: Session): Prisma.TicketWhereInput {
  return session.role === "ADMIN" ? {} : { authorId: session.authorId! };
}

export async function listTickets(session: Session, q: ListTicketsQuery) {
  const where: Prisma.TicketWhereInput = {
    ...scopeFor(session),
    status: q.status,
    category: q.category,
    priority: q.priority,
    createdAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    assigneeId: q.assignee === "me" ? session.userId : q.assignee === "unassigned" ? null : undefined,
    OR: q.q
      ? [
          { subject: { contains: q.q, mode: "insensitive" } },
          { description: { contains: q.q, mode: "insensitive" } },
          { author: { user: { name: { contains: q.q, mode: "insensitive" } } } },
        ]
      : undefined,
  };

  // Postgres sorts enums in declaration order: OPEN < IN_PROGRESS < … and CRITICAL < HIGH < …,
  // so "urgency" puts unresolved, most severe, oldest tickets first.
  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    q.sort === "newest"
      ? [{ createdAt: "desc" }]
      : q.sort === "oldest"
        ? [{ createdAt: "asc" }]
        : [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }];

  return prisma.ticket.findMany({ where, orderBy, include: listInclude, take: 200 });
}

export async function getTicket(session: Session, id: string) {
  const isAdmin = session.role === "ADMIN";
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...scopeFor(session) },
    include: {
      ...listInclude,
      book: true,
      messages: {
        // Internal notes never leave the server for authors.
        where: isAdmin ? {} : { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!ticket) throw notFound("Ticket");
  if (isAdmin) return ticket;

  // Strip triage metadata from the author view; it is an internal tool.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { aiReasoning, aiConfidence, categorySource, prioritySource, assigneeId, assignee, ...authorView } = ticket;
  return authorView;
}

export async function createTicket(session: Session, input: CreateTicketInput) {
  if (session.role !== "AUTHOR" || !session.authorId) throw forbidden("Only authors can raise tickets");

  let book: { id: string; title: string; status: string } | null = null;
  if (input.bookId) {
    book = await prisma.book.findFirst({
      where: { id: input.bookId, authorId: session.authorId },
      select: { id: true, title: true, status: true },
    });
    // Same response whether the book doesn't exist or belongs to someone else.
    if (!book) throw new ApiError("VALIDATION_FAILED", "Selected book was not found on your account", [{ path: "bookId", message: "Unknown book" }]);
  }

  return prisma.ticket.create({
    data: {
      authorId: session.authorId,
      bookId: book?.id ?? null,
      subject: input.subject,
      description: input.description,
      attachmentName: input.attachmentName,
    },
    include: listInclude,
  });
}

/**
 * Runs after the ticket is saved (outside the request) so ticket creation never waits on,
 * or fails because of, the AI provider. Labels an admin already set are left alone.
 */
export async function classifyAndStore(ticketId: string, opts: { force?: boolean } = {}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { book: { select: { title: true, status: true } } },
  });
  if (!ticket) return null;

  const { source, result } = await classifyTicket(
    { subject: ticket.subject, description: ticket.description, book: ticket.book },
    ticket.id,
  );

  const keepCategory = ticket.categorySource === "ADMIN" && !opts.force;
  const keepPriority = ticket.prioritySource === "ADMIN" && !opts.force;
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(keepCategory ? {} : { category: result.category, categorySource: source }),
      ...(keepPriority ? {} : { priority: result.priority, prioritySource: source }),
      aiConfidence: result.confidence,
      aiReasoning: result.reasoning,
    },
  });
}

export async function updateTicket(session: Session, id: string, input: UpdateTicketInput) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw notFound("Ticket");

  let assigneeId: string | null | undefined = undefined;
  if (input.assigneeId === "me") assigneeId = session.userId;
  else if (input.assigneeId === null) assigneeId = null;
  else if (input.assigneeId) {
    const admin = await prisma.user.findFirst({ where: { id: input.assigneeId, role: "ADMIN" } });
    if (!admin) throw new ApiError("VALIDATION_FAILED", "Tickets can only be assigned to admins", [{ path: "assigneeId", message: "Not an admin" }]);
    assigneeId = admin.id;
  }

  return prisma.ticket.update({
    where: { id },
    data: {
      status: input.status,
      resolvedAt: input.status ? (isDone(input.status) ? existing.resolvedAt ?? new Date() : null) : undefined,
      // An admin override is sticky: later AI re-classification will not undo it.
      ...(input.category && { category: input.category, categorySource: "ADMIN" }),
      ...(input.priority && { priority: input.priority, prioritySource: "ADMIN" }),
      assigneeId,
    },
    include: listInclude,
  });
}

const isDone = (s: TicketStatus) => s === "RESOLVED" || s === "CLOSED";

export async function addMessage(session: Session, ticketId: string, input: CreateMessageInput) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, ...scopeFor(session) } });
  if (!ticket) throw notFound("Ticket");

  const isAdmin = session.role === "ADMIN";
  if (!isAdmin && input.isInternal) throw forbidden("Authors cannot add internal notes");
  if (!isAdmin && ticket.status === "CLOSED") {
    throw new ApiError("CONFLICT", "This ticket is closed. Please raise a new ticket if you need more help.");
  }

  let fromAiDraft = false;
  let aiEdited = false;
  if (isAdmin && input.draftId) {
    const draft = await prisma.aiDraft.findFirst({ where: { id: input.draftId, ticketId } });
    if (draft) {
      fromAiDraft = true;
      aiEdited = draft.body.trim() !== input.body.trim();
    }
  }

  // Status moves with the conversation so admins don't have to remember to flip it:
  // the first public reply moves Open → In Progress; an author reply re-opens a resolved ticket.
  let status: TicketStatus | undefined;
  if (isAdmin && !input.isInternal && ticket.status === "OPEN") status = "IN_PROGRESS";
  if (!isAdmin && ticket.status === "RESOLVED") status = "OPEN";

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderId: session.userId, body: input.body, isInternal: isAdmin && input.isInternal, fromAiDraft, aiEdited },
      include: { sender: { select: { id: true, name: true, role: true } } },
    }),
    // Always touch the ticket so updatedAt drives the real-time feed.
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt: status === "OPEN" ? null : undefined,
        firstResponseAt: isAdmin && !input.isInternal && !ticket.firstResponseAt ? new Date() : undefined,
        assigneeId: isAdmin && !input.isInternal && !ticket.assigneeId ? session.userId : undefined,
      },
    }),
  ]);
  return message;
}

async function buildDraftContext(ticketId: string, adminName: string): Promise<DraftContext | null> {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      book: true,
      author: { include: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { role: true } } } },
    },
  });
  if (!t) return null;
  const category: Category = t.category === "UNCLASSIFIED" ? "GENERAL_INQUIRY" : t.category;
  return {
    category,
    authorName: t.author.user.name,
    adminName,
    ticket: { subject: t.subject, description: t.description, createdAt: t.createdAt },
    book: t.book,
    thread: t.messages.map((m) => ({
      from: m.isInternal ? "internal_note" : m.sender.role === "ADMIN" ? "support" : "author",
      body: m.body,
      at: m.createdAt,
    })),
  };
}

export type DraftResponse =
  | { status: "ready"; draft: { id: string; body: string; model: string; createdAt: Date; cached: boolean } }
  | { status: "unavailable"; reason: string };

/**
 * Returns the AI draft for a ticket, reusing the stored one when nothing it depends on has
 * changed. `regenerate` forces a new call (the admin clicked "Regenerate").
 */
export async function getDraft(session: Session, ticketId: string, opts: { regenerate?: boolean } = {}): Promise<DraftResponse> {
  const ctx = await buildDraftContext(ticketId, session.name);
  if (!ctx) throw notFound("Ticket");
  if (!aiEnabled()) return { status: "unavailable", reason: "not_configured" };

  const { hash } = draftCacheKey(ctx);
  if (!opts.regenerate) {
    const cached = await prisma.aiDraft.findFirst({
      where: { ticketId, contextHash: hash },
      orderBy: { createdAt: "desc" },
    });
    if (cached) return { status: "ready", draft: { ...pickDraft(cached), cached: true } };
  }

  const result = await generateDraft(ctx, ticketId);
  if (!result.ok) return { status: "unavailable", reason: result.reason };

  const saved = await prisma.aiDraft.create({
    data: { ticketId, body: result.body, model: result.model, promptVersion: result.promptVersion, contextHash: result.contextHash },
  });
  return { status: "ready", draft: { ...pickDraft(saved), cached: false } };
}

const pickDraft = (d: { id: string; body: string; model: string; createdAt: Date }) => ({
  id: d.id,
  body: d.body,
  model: d.model,
  createdAt: d.createdAt,
});

/** Ids of tickets visible to this session that changed after `since`. Feeds the SSE stream. */
export async function changedTicketIds(session: Session, since: Date) {
  const rows = await prisma.ticket.findMany({
    where: { ...scopeFor(session), updatedAt: { gt: since } },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  return rows;
}
