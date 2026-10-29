import { NextResponse } from "next/server";
import { createMessageSchema } from "@/lib/validation";
import { ANY_ROLE, readJson, route } from "@/server/http/route";
import { addMessage } from "@/server/services/ticketService";

export const POST = route<{ id: string }>(ANY_ROLE, async ({ req, session, params }) => {
  const input = createMessageSchema.parse(await readJson(req));
  return NextResponse.json({ data: await addMessage(session, params.id, input) }, { status: 201 });
});
