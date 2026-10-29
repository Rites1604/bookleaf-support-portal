import type { Category, Priority } from "@/lib/domain";

/**
 * Keyword rules used when the LLM is unavailable (no key, outage, rate limit).
 * Deliberately simple: it only needs to get a ticket into roughly the right queue
 * until an admin or a later AI retry confirms it. Tickets labelled this way are
 * marked FALLBACK so the queue shows them as "needs review".
 */
const CATEGORY_RULES: [Category, RegExp][] = [
  // Account-level requests mention platforms ("my bio on Amazon") but are not distribution problems.
  ["GENERAL_INQUIRY", /author bio|\bbio\b|biography|profile photo|change (my )?(email|password|bank)|(update|change|edit) (the |my )?(book )?description/i],
  ["ISBN_METADATA", /\bisbn\b|metadata|wrong (book|title|author)|barcode|imprint/i],
  ["ROYALTY_PAYMENTS", /royalt|payout|payment|paid|bank|earning|₹|\brs\.?\b|money|invoice/i],
  ["PRINTING_QUALITY", /print(ing)? quality|misprint|blurr|binding|pages? (are )?(missing|misaligned|torn)|defect|colou?r|author cop/i],
  ["DISTRIBUTION_AVAILABILITY", /unavailable|out of stock|amazon|flipkart|listing|not (showing|visible|available)|distribut/i],
  ["BOOK_STATUS_PRODUCTION", /typesetting|cover design|proof|production|when will|status of my book|still in|delay/i],
];

const CRITICAL = /legal|lawyer|fraud|scam|police|consumer court|\b(6|six|7|seven|8|eight|9|nine|10|ten|12|twelve) months\b|never (been )?paid|wrong book linked|duplicate isbn/i;
const HIGH = /currently unavailable|\b(3|three|4|four|5|five) months\b|urgent|asap|immediately|not received|haven'?t received|wrong isbn|different isbn|terrible|unacceptable|launch|event/i;
const LOW = /\bbio\b|biography|how (do|can) i|can i|is it possible|question|curious|update (my|the) description/i;

export function fallbackClassify(text: string): { category: Category; priority: Priority } {
  const category = CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? "GENERAL_INQUIRY";

  let priority: Priority = "MEDIUM";
  if (CRITICAL.test(text)) priority = "CRITICAL";
  else if (HIGH.test(text) || category === "ISBN_METADATA") priority = "HIGH"; // KB: ISBN errors are always high priority
  else if (LOW.test(text)) priority = "LOW";

  return { category, priority };
}
