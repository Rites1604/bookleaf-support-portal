// Shapes returned by the API, as seen by the client (dates arrive as ISO strings).
import type { Category, Priority, RoyaltyFacts, Status } from "./domain";

export type LabelSource = "PENDING" | "AI" | "FALLBACK" | "ADMIN";

export type BookDto = {
  id: string;
  bookCode: string;
  title: string;
  isbn: string;
  genre: string;
  status: string;
  publicationDate: string | null;
  mrp: number | null;
  royaltyPerCopy: number | null;
  copiesSold: number;
  royaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
  inProduction: boolean;
  productionStage: string | null;
  royalty: RoyaltyFacts | null;
};

export type MessageDto = {
  id: string;
  body: string;
  isInternal: boolean;
  fromAiDraft: boolean;
  createdAt: string;
  sender: { id: string; name: string; role: "AUTHOR" | "ADMIN" };
};

export type TicketDto = {
  id: string;
  subject: string;
  description: string;
  attachmentName: string | null;
  status: Status;
  category: Category | "UNCLASSIFIED";
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  book: { id: string; title: string; status: string } | null;
  author: { id: string; authorCode: string; user: { name: string; email: string } };
  _count?: { messages: number };
  messages?: MessageDto[];
  // Admin-only fields
  categorySource?: LabelSource;
  prioritySource?: LabelSource;
  aiConfidence?: number | null;
  aiReasoning?: string | null;
  assignee?: { id: string; name: string } | null;
};

export type DraftDto =
  | { status: "ready"; draft: { id: string; body: string; model: string; createdAt: string; cached: boolean } }
  | { status: "unavailable"; reason: string };
