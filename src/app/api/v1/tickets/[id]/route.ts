import { NextResponse } from "next/server";
import { updateTicketSchema } from "@/lib/validation";
import { ADMIN_ONLY, ANY_ROLE, readJson, route } from "@/server/http/route";
import { getTicket, updateTicket } from "@/server/services/ticketService";

type Params = { id: string };

export const GET = route<Params>(ANY_ROLE, async ({ session, params }) =>
  NextResponse.json({ data: await getTicket(session, params.id) }),
);

export const PATCH = route<Params>(ADMIN_ONLY, async ({ req, session, params }) => {
  const input = updateTicketSchema.parse(await readJson(req));
  return NextResponse.json({ data: await updateTicket(session, params.id, input) });
});
