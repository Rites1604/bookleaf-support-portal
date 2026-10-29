import { createHash } from "node:crypto";
import { AiUnavailableError, getClient, MODELS, recordUsage, toAiFailure, type AiFailureReason } from "./client";
import { DRAFT_PROMPT_VERSION, DRAFT_SYSTEM, draftUserMessage, type DraftContext } from "./prompts/draft";

export type DraftResult =
  | { ok: true; body: string; model: string; promptVersion: string; contextHash: string }
  | { ok: false; reason: AiFailureReason };

/**
 * A draft depends only on the prompt it was built from, so hashing that prompt
 * gives a cache key: reopening a ticket reuses the stored draft, and a new author
 * message (or a category change) produces a new hash and a fresh draft.
 */
export function draftCacheKey(ctx: DraftContext): { prompt: string; hash: string } {
  const prompt = draftUserMessage(ctx);
  const hash = createHash("sha256").update(`${DRAFT_PROMPT_VERSION}|${MODELS.draft}|${prompt}`).digest("hex").slice(0, 32);
  return { prompt, hash };
}

export async function generateDraft(ctx: DraftContext, ticketId: string): Promise<DraftResult> {
  const { prompt, hash } = draftCacheKey(ctx);
  const startedAt = Date.now();
  try {
    const response = await getClient().messages.create({
      model: MODELS.draft,
      max_tokens: 2048,
      // A 200-word reply grounded in supplied facts doesn't need deep reasoning.
      output_config: { effort: "low" },
      system: [{ type: "text", text: DRAFT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    await recordUsage({ task: "draft", model: MODELS.draft, ticketId, usage: response.usage, startedAt, success: true });

    if (response.stop_reason === "refusal") throw new AiUnavailableError("refused");
    const body = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    if (!body || response.stop_reason === "max_tokens") throw new AiUnavailableError("bad_output");

    return { ok: true, body, model: MODELS.draft, promptVersion: DRAFT_PROMPT_VERSION, contextHash: hash };
  } catch (err) {
    const failure = toAiFailure(err);
    if (failure.reason !== "not_configured") {
      await recordUsage({ task: "draft", model: MODELS.draft, ticketId, startedAt, success: false, errorCode: failure.reason });
      console.warn(`[ai] draft generation failed: ${failure.reason}`);
    }
    return { ok: false, reason: failure.reason };
  }
}
