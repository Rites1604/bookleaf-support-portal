import { describe, expect, it } from "vitest";
import { nextPayoutDeadline, royaltyFacts } from "@/lib/domain";
import { fallbackClassify } from "@/server/ai/fallbackClassifier";
import { PRIORITY_RANK } from "@/lib/domain";
import { SAMPLE_QUERIES } from "./samples";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("royalty rules", () => {
  it("next payout deadline is 45 days after the current quarter ends", () => {
    expect(nextPayoutDeadline(day("2026-10-29")).toISOString().slice(0, 10)).toBe("2027-02-14");
    expect(nextPayoutDeadline(day("2026-02-01")).toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("flags pending amounts under ₹1,000 as rollover, not overdue", () => {
    const f = royaltyFacts({ royaltyPending: 850, lastPayoutDate: null, publicationDate: day("2024-11-05") }, day("2026-10-29"));
    expect(f.belowThreshold).toBe(true);
    expect(f.likelyOverdue).toBe(false);
    expect(f.neverPaid).toBe(true);
  });

  it("flags a payout overdue after a quarter plus 45 days with nothing paid", () => {
    const f = royaltyFacts({ royaltyPending: 2546, lastPayoutDate: null, publicationDate: day("2024-07-05") }, day("2026-10-29"));
    expect(f.likelyOverdue).toBe(true);
  });

  it("does not flag zero pending as overdue", () => {
    const f = royaltyFacts({ royaltyPending: 0, lastPayoutDate: day("2025-12-01"), publicationDate: day("2024-01-10") }, day("2026-10-29"));
    expect(f.likelyOverdue).toBe(false);
    expect(f.belowThreshold).toBe(false);
  });
});

describe("fallback classifier", () => {
  it.each(SAMPLE_QUERIES)("labels: $text", ({ text, category, minPriority }) => {
    const r = fallbackClassify(text);
    expect(r.category).toBe(category);
    expect(PRIORITY_RANK[r.priority]).toBeLessThanOrEqual(PRIORITY_RANK[minPriority]);
  });
});
