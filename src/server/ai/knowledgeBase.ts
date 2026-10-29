import type { Category } from "@/lib/domain";

/**
 * The BookLeaf Knowledge Base, split into sections so a draft only carries the
 * policy that matters for its category (plus the always-on tone rules). Sending
 * the whole KB on every call would roughly triple input tokens for no gain.
 */

export const COMPANY_OVERVIEW = `BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books.`;

export const TONE_GUIDELINES = `- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: use the actual numbers, dates and statuses from the author's record rather than vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline ("Our team will look into this and get back to you within 48 hours"), never an open-ended promise.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

type Section = { policy: string; example: { query: string; guidance: string } };

const SECTIONS: Record<Category, Section> = {
  ROYALTY_PAYMENTS: {
    policy: `Royalty Policy:
- 80/20 split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is ₹1,000. Below that, the amount rolls over to the next quarter.
- Payouts are made by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown, with sales per platform, in their dashboard.`,
    example: {
      query: "I published my book 4 months ago and still haven't received any royalty. What's going on?",
      guidance:
        "Acknowledge the frustration. Explain the quarterly cycle and 45-day payout window. Ask them to confirm their bank details are linked. Give the specific next payout date. If the payment is genuinely overdue, own it and escalate with a 48-hour resolution timeline.",
    },
  },
  ISBN_METADATA: {
    policy: `ISBN Policy:
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- Authors who want an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked, mismatch between platforms and print) is high priority and is escalated to the production team.
Metadata: description and other metadata updates can be submitted through the dashboard or by emailing the BookLeaf team; changes reflect on platforms within 3-5 business days.`,
    example: {
      query: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
      guidance:
        "Treat as high priority. Acknowledge this is a serious data issue. Confirm it is being escalated to the production team immediately. Give a 48-hour resolution timeline.",
    },
  },
  PRINTING_QUALITY: {
    policy: `Printing & Quality:
- In-house printing handles most orders; overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency) BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`,
    example: {
      query: "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
      guidance:
        "Apologise sincerely. Ask for photos of the defective copies. Confirm BookLeaf will arrange a free reprint once verified, with a 5-7 business day timeline.",
    },
  },
  DISTRIBUTION_AVAILABILITY: {
    policy: `Distribution & Availability:
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7-10 business days after publication is complete.
- "Unavailable" on a platform usually means a stock sync issue; BookLeaf can trigger a re-sync within 24-48 hours.`,
    example: {
      query: "My book is published but it's showing as 'Currently Unavailable' on Amazon.",
      guidance:
        "Explain it is typically a stock sync issue. Confirm a re-sync is being triggered with the distribution team. Set the expectation of 24-48 hours to go live again.",
    },
  },
  BOOK_STATUS_PRODUCTION: {
    policy: `Production Stages, in order: Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated by email at each stage.
- Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
    example: {
      query: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
      guidance:
        "Use the actual production status. If delayed, be honest about why. Give a specific updated timeline. Never blame the author even if the delay is on their side; frame it collaboratively.",
    },
  },
  GENERAL_INQUIRY: {
    policy: `General:
- Metadata (book description, author bio) updates can be submitted through the dashboard or by emailing the BookLeaf team; changes reflect on platforms within 3-5 business days.
- Publishing packages: Standard Free and Bestseller Breakthrough (paid, with marketing and distribution add-ons).`,
    example: {
      query: "Can I update the description of my book on Amazon after it's already live?",
      guidance:
        "Yes: submit through the dashboard or by emailing the team; changes reflect within 3-5 business days.",
    },
  },
};

export function kbSectionFor(category: Category): Section {
  return SECTIONS[category];
}

/** One line per category, used by the classifier instead of the full KB. */
export const CATEGORY_GUIDE = `- ROYALTY_PAYMENTS: royalty amounts, missing or late payouts, bank details, royalty calculation, sales figures tied to earnings.
- ISBN_METADATA: wrong/duplicate/mismatched ISBN, wrong book linked, title/author/description metadata errors on listings.
- PRINTING_QUALITY: physical copy defects (blurry images, misaligned pages, binding, colour), author copy orders, print turnaround.
- DISTRIBUTION_AVAILABILITY: book missing or "unavailable" on Amazon/Flipkart/BookLeaf Store, new listing not live, marketplace stock.
- BOOK_STATUS_PRODUCTION: where a book is in production (cover design, typesetting, proofreading…), production delays, launch timing.
- GENERAL_INQUIRY: account-level questions, author bio, packages, how-to questions that are not a problem with one of the above.`;
