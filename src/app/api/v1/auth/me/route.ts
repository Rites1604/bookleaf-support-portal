import { NextResponse } from "next/server";
import { ANY_ROLE, route } from "@/server/http/route";
import { aiEnabled } from "@/server/ai/client";

export const GET = route(ANY_ROLE, async ({ session }) =>
  NextResponse.json({
    user: { id: session.userId, name: session.name, role: session.role, authorId: session.authorId ?? null },
    // Lets the admin UI show "AI off" up front instead of discovering it per ticket.
    aiEnabled: session.role === "ADMIN" ? aiEnabled() : undefined,
  }),
);
