import { NextResponse } from "next/server";
import { ADMIN_ONLY, route } from "@/server/http/route";
import { prisma } from "@/server/db";
import { aiEnabled, MODELS } from "@/server/ai/client";

// USD per million tokens. Kept here rather than in the DB because it's only for a rough
// dashboard estimate; billing truth lives in the provider console.
const PRICE: Record<string, { in: number; out: number; cached: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cached: 0.01 },
  "claude-sonnet-5-5": { in: 2, out: 10, cached: 0.2 },
};

export const GET = route(ADMIN_ONLY, async () => {
  const rows = await prisma.aiUsage.groupBy({
    by: ["task", "model", "success"],
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true, cachedTokens: true, latencyMs: true },
  });
  const [draftsSent, draftsEdited] = await Promise.all([
    prisma.ticketMessage.count({ where: { fromAiDraft: true } }),
    prisma.ticketMessage.count({ where: { fromAiDraft: true, aiEdited: true } }),
  ]);

  const byTask = rows.map((r) => {
    const p = PRICE[r.model];
    const inTok = r._sum.inputTokens ?? 0;
    const outTok = r._sum.outputTokens ?? 0;
    const cached = r._sum.cachedTokens ?? 0;
    return {
      task: r.task,
      model: r.model,
      success: r.success,
      calls: r._count._all,
      inputTokens: inTok,
      outputTokens: outTok,
      cachedTokens: cached,
      avgLatencyMs: r._count._all ? Math.round((r._sum.latencyMs ?? 0) / r._count._all) : 0,
      estCostUsd: p ? (inTok * p.in + outTok * p.out + cached * p.cached) / 1_000_000 : null,
    };
  });

  return NextResponse.json({
    data: { aiEnabled: aiEnabled(), models: MODELS, byTask, drafts: { sent: draftsSent, editedBeforeSending: draftsEdited } },
  });
});
