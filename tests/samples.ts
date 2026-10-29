import type { Category, Priority } from "@/lib/domain";

/** The sample queries from the BookLeaf brief, with the labels a support lead would give them. */
export const SAMPLE_QUERIES: { text: string; category: Category; minPriority: Priority }[] = [
  // Without account data, 4 months can still be inside the quarterly + 45-day cycle, so Medium is acceptable here;
  // on a real ticket the payout status from the author's record decides whether it escalates.
  { text: "I published my book 4 months ago and still haven't received any royalty. What's going on?", category: "ROYALTY_PAYMENTS", minPriority: "MEDIUM" },
  { text: "My royalty amount seems too low. I sold 200 copies but only received ₹3,000.", category: "ROYALTY_PAYMENTS", minPriority: "MEDIUM" },
  { text: "My book is showing a different ISBN on Amazon than what's on the physical copy.", category: "ISBN_METADATA", minPriority: "HIGH" },
  { text: "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.", category: "PRINTING_QUALITY", minPriority: "HIGH" },
  { text: "My book is published but it's showing as \"Currently Unavailable\" on Amazon.", category: "DISTRIBUTION_AVAILABILITY", minPriority: "HIGH" },
  { text: "It's been 3 weeks and my book is still in typesetting. When will it be done?", category: "BOOK_STATUS_PRODUCTION", minPriority: "MEDIUM" },
  { text: "Can I update the description of my book on Amazon after it's already live?", category: "GENERAL_INQUIRY", minPriority: "LOW" },
  { text: "I haven't received any royalty for 6 months.", category: "ROYALTY_PAYMENTS", minPriority: "CRITICAL" },
  { text: "Can I update my author bio?", category: "GENERAL_INQUIRY", minPriority: "LOW" },
];
