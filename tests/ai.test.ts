import { beforeEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

// The usage ledger writes to Postgres; the AI tests don't need it.
vi.mock("@/server/db", () => ({ prisma: { aiUsage: { create: vi.fn() } } }));

const parse = vi.fn();
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", async (orig) => {
  const actual = await orig<typeof import("@anthropic-ai/sdk")>();
  // Subclass so the static error classes (Anthropic.RateLimitError, …) stay real.
  class FakeClient extends actual.default {
    messages = { parse, create } as never;
  }
  return { ...actual, default: FakeClient };
});

const { classifyTicket } = await import("@/server/ai/classifier");
const { generateDraft, draftCacheKey } = await import("@/server/ai/drafter");
const { authorRecord, draftUserMessage, DRAFT_SYSTEM } = await import("@/server/ai/prompts/draft");
type DraftContext = import("@/server/ai/prompts/draft").DraftContext;

const usage = { input_tokens: 500, output_tokens: 60, cache_read_input_tokens: 0 };
const ticket = { subject: "No royalty for 6 months", description: "I haven't received any royalty for 6 months now.", book: null };

function ctx(overrides: Partial<DraftContext> = {}): DraftContext {
  return {
    category: "ROYALTY_PAYMENTS",
    authorName: "Ananya Reddy",
    adminName: "Support Admin",
    ticket: { subject: "No royalty", description: "Nothing paid since publication.", createdAt: new Date("2026-10-26") },
    book: {
      title: "Between Two Temples",
      isbn: "978-93-5XXXX-05-9",
      status: "Published & Live",
      publicationDate: new Date("2024-07-05"),
      mrp: 425,
      royaltyPerCopy: 38,
      copiesSold: 67,
      royaltyEarned: 2546,
      royaltyPaid: 0,
      royaltyPending: 2546,
      lastPayoutDate: null,
      printPartner: "Epitome Books",
      availableOn: ["Amazon India", "BookLeaf Store"],
    },
    thread: [],
    ...overrides,
  };
}

beforeEach(() => {
  parse.mockReset();
  create.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("classifyTicket", () => {
  it("returns the model's structured output", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      usage,
      parsed_output: { category: "ROYALTY_PAYMENTS", priority: "CRITICAL", confidence: 0.92, reasoning: "Six months unpaid." },
    });
    const r = await classifyTicket(ticket);
    expect(r.source).toBe("AI");
    expect(r.result.priority).toBe("CRITICAL");
  });

  it("falls back to keyword rules when rate limited", async () => {
    parse.mockRejectedValue(new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers()));
    const r = await classifyTicket(ticket);
    expect(r).toMatchObject({ source: "FALLBACK", reason: "rate_limited" });
    expect(r.result.category).toBe("ROYALTY_PAYMENTS");
  });

  it("falls back without calling the API when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await classifyTicket(ticket);
    expect(r).toMatchObject({ source: "FALLBACK", reason: "not_configured" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("falls back when the model refuses", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", usage, parsed_output: null });
    expect(await classifyTicket(ticket)).toMatchObject({ source: "FALLBACK", reason: "refused" });
  });
});

describe("draft prompt", () => {
  it("sends only the KB section for the ticket's category", () => {
    const msg = draftUserMessage(ctx());
    expect(msg).toContain("80/20 split");
    expect(msg).not.toContain("free reprint");
    expect(msg).not.toContain("re-sync");
  });

  it("includes the author's real figures and the overdue flag", () => {
    const rec = authorRecord(ctx(), new Date("2026-10-29"));
    expect(rec).toContain("pending: ₹2,546");
    expect(rec).toContain("none yet (never paid)");
    expect(rec).toContain("FLAG: payout appears overdue");
  });

  it("omits the royalty ledger for a printing complaint", () => {
    const rec = authorRecord(ctx({ category: "PRINTING_QUALITY" }));
    expect(rec).not.toContain("Royalty earned");
    expect(rec).toContain("Print partner: Epitome Books");
  });

  it("keeps only the last four messages and trims long ones", () => {
    const thread = Array.from({ length: 7 }, (_, i) => ({ from: "author" as const, body: `msg${i} ${"x".repeat(2000)}`, at: new Date() }));
    const msg = draftUserMessage(ctx({ thread }));
    expect(msg).toContain('earlier_messages_omitted="3"');
    expect(msg).not.toContain("msg2 ");
    expect(msg).toContain("msg6 ");
    expect(msg.length).toBeLessThan(9000);
  });

  it("keeps the system prompt free of per-request data so it can be cached", () => {
    expect(DRAFT_SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}|Ananya|Support Admin/);
  });

  it("changes the cache key when a new author message arrives", () => {
    const a = draftCacheKey(ctx()).hash;
    const b = draftCacheKey(ctx({ thread: [{ from: "author", body: "Any update?", at: new Date() }] })).hash;
    expect(a).not.toBe(b);
    expect(draftCacheKey(ctx()).hash).toBe(a);
  });
});

describe("generateDraft", () => {
  it("returns the text of the reply", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", usage, content: [{ type: "text", text: "Hi Ananya, …" }] });
    const r = await generateDraft(ctx(), "t1");
    expect(r).toMatchObject({ ok: true, body: "Hi Ananya, …" });
  });

  it("reports a truncated reply as unusable instead of sending half a draft", async () => {
    create.mockResolvedValue({ stop_reason: "max_tokens", usage, content: [{ type: "text", text: "Hi Ananya, we" }] });
    expect(await generateDraft(ctx(), "t1")).toEqual({ ok: false, reason: "bad_output" });
  });

  it("reports provider outages without throwing", async () => {
    create.mockRejectedValue(new Anthropic.InternalServerError(500, undefined, "down", new Headers()));
    expect(await generateDraft(ctx(), "t1")).toEqual({ ok: false, reason: "provider_error" });
  });
});
