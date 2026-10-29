// Shared by server and client: enum values, human labels and royalty rules from the BookLeaf KB.

export const CATEGORIES = [
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category | "UNCLASSIFIED", string> = {
  UNCLASSIFIED: "Classifying…",
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Unresolved tickets older than this are flagged in the admin queue (the KB promises 48h on escalations). */
export const SLA_HOURS = 48;

export const PRODUCTION_STAGES = [
  "Manuscript Received",
  "Editing",
  "Cover Design",
  "Typesetting",
  "Proofreading",
  "ISBN Assignment",
  "Printing",
  "Distribution Setup",
  "Published & Live",
] as const;

export function productionStage(status: string): string {
  return status.startsWith("In Production - ") ? status.slice("In Production - ".length) : status;
}

export function isInProduction(status: string): boolean {
  return status.startsWith("In Production");
}

// ---- Royalty rules (KB: quarterly, paid within 45 days of quarter end, ₹1,000 minimum) ----

export const PAYOUT_THRESHOLD_INR = 1000;
const PAYOUT_WINDOW_DAYS = 45;
/** A payout is treated as overdue once a full quarter plus the 45-day window has passed with no payment. */
const OVERDUE_AFTER_DAYS = 90 + PAYOUT_WINDOW_DAYS;

const DAY_MS = 86_400_000;

/** The latest date the next payout is due: 45 days after the end of the current quarter. */
export function nextPayoutDeadline(today: Date): Date {
  const q = Math.floor(today.getUTCMonth() / 3);
  const quarterEnd = new Date(Date.UTC(today.getUTCFullYear(), q * 3 + 3, 0));
  return new Date(quarterEnd.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS);
}

export type RoyaltyFacts = {
  pending: number;
  belowThreshold: boolean;
  nextPayoutBy: string; // YYYY-MM-DD
  daysSinceLastPayout: number | null;
  neverPaid: boolean;
  likelyOverdue: boolean;
};

export function royaltyFacts(
  book: { royaltyPending: number; lastPayoutDate: Date | string | null; publicationDate: Date | string | null },
  today = new Date(),
): RoyaltyFacts {
  const last = book.lastPayoutDate ? new Date(book.lastPayoutDate) : null;
  const since = last ?? (book.publicationDate ? new Date(book.publicationDate) : null);
  const daysSince = since ? Math.floor((today.getTime() - since.getTime()) / DAY_MS) : null;
  const belowThreshold = book.royaltyPending > 0 && book.royaltyPending < PAYOUT_THRESHOLD_INR;
  return {
    pending: book.royaltyPending,
    belowThreshold,
    nextPayoutBy: nextPayoutDeadline(today).toISOString().slice(0, 10),
    daysSinceLastPayout: last ? daysSince : null,
    neverPaid: !last,
    likelyOverdue: !belowThreshold && book.royaltyPending > 0 && daysSince !== null && daysSince > OVERDUE_AFTER_DAYS,
  };
}

export const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN")}`;
