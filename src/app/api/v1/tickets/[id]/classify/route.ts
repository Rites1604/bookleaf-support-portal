import { NextResponse } from "next/server";
import { ADMIN_ONLY, route } from "@/server/http/route";
import { notFound } from "@/server/http/errors";
import { classifyAndStore } from "@/server/services/ticketService";

// Re-runs AI classification, e.g. for tickets labelled by the fallback during an outage.
// Admin overrides stay in place unless ?force=true.
export const POST = route<{ id: string }>(ADMIN_ONLY, async ({ req, params }) => {
  const force = req.nextUrl.searchParams.get("force") === "true";
  const ticket = await classifyAndStore(params.id, { force });
  if (!ticket) throw notFound("Ticket");
  return NextResponse.json({ data: ticket });
});
