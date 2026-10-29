import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fallbackClassify } from "./fallbackClassifier";
import { AiUnavailableError, getClient, MODELS, recordUsage, toAiFailure } from "./client";
import {
  CLASSIFY_SYSTEM,
  classificationSchema,
  classifyUserMessage,
  type Classification,
} from "./prompts/classify";

export type ClassifyResult =
  | { source: "AI"; result: Classification }
  | { source: "FALLBACK"; result: Classification; reason: string };

/**
 * Classifies a ticket. Never throws: if the model is unavailable or returns something
 * unusable, the keyword fallback answers and the result is marked FALLBACK.
 */
export async function classifyTicket(
  input: Parameters<typeof classifyUserMessage>[0],
  ticketId?: string,
): Promise<ClassifyResult> {
  const startedAt = Date.now();
  try {
    const response = await getClient().messages.parse({
      model: MODELS.classify,
      max_tokens: 1024,
      // Triage is a short, well-specified task; low effort keeps it fast and cheap.
      output_config: { effort: "low", format: zodOutputFormat(classificationSchema) },
      system: [{ type: "text", text: CLASSIFY_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: classifyUserMessage(input) }],
    });
    await recordUsage({ task: "classify", model: MODELS.classify, ticketId, usage: response.usage, startedAt, success: true });

    if (response.stop_reason === "refusal") throw new AiUnavailableError("refused");
    if (!response.parsed_output) throw new AiUnavailableError("bad_output");
    const result = response.parsed_output;
    return { source: "AI", result: { ...result, confidence: Math.min(1, Math.max(0, result.confidence)) } };
  } catch (err) {
    const failure = toAiFailure(err);
    if (failure.reason !== "not_configured") {
      await recordUsage({ task: "classify", model: MODELS.classify, ticketId, startedAt, success: false, errorCode: failure.reason });
      console.warn(`[ai] classification fell back to rules: ${failure.reason}`);
    }
    const rules = fallbackClassify(`${input.subject}\n${input.description}`);
    return {
      source: "FALLBACK",
      reason: failure.reason,
      result: { ...rules, confidence: 0.4, reasoning: "Labelled by keyword rules because the AI classifier was unavailable." },
    };
  }
}
