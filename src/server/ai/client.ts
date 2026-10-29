import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db";

/**
 * Thin wrapper around the Anthropic SDK. Everything AI-related goes through here so
 * that timeouts, retries, usage logging and "is AI configured at all" live in one place.
 * The key is read from the server environment only; nothing here is imported by client code.
 */

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getClient(): Anthropic {
  if (!aiEnabled()) throw new AiUnavailableError("not_configured");
  client ??= new Anthropic({
    timeout: Number(process.env.AI_TIMEOUT_MS ?? 15_000),
    // The SDK retries 408/409/429/5xx and connection errors with exponential backoff.
    maxRetries: 2,
  });
  return client;
}

export const MODELS = {
  classify: process.env.AI_CLASSIFY_MODEL ?? "claude-haiku-5-5",
  draft: process.env.AI_DRAFT_MODEL ?? "claude-sonnet-5-5",
};

export type AiFailureReason = "not_configured" | "rate_limited" | "timeout" | "provider_error" | "bad_output" | "refused";

export class AiUnavailableError extends Error {
  constructor(public reason: AiFailureReason) {
    super(`AI unavailable: ${reason}`);
  }
}

/** Maps SDK errors (already retried by the SDK) onto a small set of reasons the UI can explain. */
export function toAiFailure(err: unknown): AiUnavailableError {
  if (err instanceof AiUnavailableError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiUnavailableError("rate_limited");
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiUnavailableError("timeout");
  if (err instanceof Anthropic.APIError) return new AiUnavailableError("provider_error");
  return new AiUnavailableError("provider_error");
}

export async function recordUsage(entry: {
  task: "classify" | "draft";
  model: string;
  ticketId?: string;
  usage?: Anthropic.Usage;
  startedAt: number;
  success: boolean;
  errorCode?: string;
}) {
  try {
    await prisma.aiUsage.create({
      data: {
        task: entry.task,
        model: entry.model,
        ticketId: entry.ticketId,
        inputTokens: entry.usage?.input_tokens ?? 0,
        outputTokens: entry.usage?.output_tokens ?? 0,
        cachedTokens: entry.usage?.cache_read_input_tokens ?? 0,
        latencyMs: Date.now() - entry.startedAt,
        success: entry.success,
        errorCode: entry.errorCode,
      },
    });
  } catch (e) {
    // Usage logging must never break the user-facing flow.
    console.warn("[ai] failed to record usage", e);
  }
}
