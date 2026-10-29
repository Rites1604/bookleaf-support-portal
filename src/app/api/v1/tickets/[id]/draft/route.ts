import { NextResponse } from "next/server";
import { ADMIN_ONLY, route } from "@/server/http/route";
import { getDraft } from "@/server/services/ticketService";

// GET returns the cached draft (generating one if none matches the current ticket state).
export const GET = route<{ id: string }>(ADMIN_ONLY, async ({ session, params }) =>
  NextResponse.json({ data: await getDraft(session, params.id) }),
);

// POST always generates a fresh draft ("Regenerate").
export const POST = route<{ id: string }>(ADMIN_ONLY, async ({ session, params }) =>
  NextResponse.json({ data: await getDraft(session, params.id, { regenerate: true }) }),
);
