import { prisma } from "@/server/db";
import type { Session } from "@/server/auth/session";
import { isInProduction, productionStage, royaltyFacts } from "@/lib/domain";

/** Authors get their own books; admins can pass an authorId (used by the ticket sidebar). */
export async function listBooks(session: Session, authorId?: string) {
  const scopedAuthor = session.role === "ADMIN" ? authorId : session.authorId;
  const books = await prisma.book.findMany({
    where: scopedAuthor ? { authorId: scopedAuthor } : {},
    orderBy: [{ publicationDate: { sort: "desc", nulls: "first" } }, { title: "asc" }],
    include: session.role === "ADMIN" ? { author: { select: { authorCode: true, user: { select: { name: true } } } } } : undefined,
  });

  const today = new Date();
  return books.map((b) => ({
    ...b,
    inProduction: isInProduction(b.status),
    productionStage: isInProduction(b.status) ? productionStage(b.status) : null,
    royalty: isInProduction(b.status) ? null : royaltyFacts(b, today),
  }));
}
