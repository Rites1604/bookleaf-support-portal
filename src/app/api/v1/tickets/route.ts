import { NextResponse, after } from "next/server";
import { createTicketSchema, listTicketsQuery } from "@/lib/validation";
import { ANY_ROLE, AUTHOR_ONLY, readJson, route } from "@/server/http/route";
import { classifyAndStore, createTicket, listTickets } from "@/server/services/ticketService";

export const GET = route(ANY_ROLE, async ({ req, session }) => {
  const q = listTicketsQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json({ data: await listTickets(session, q) });
});

export const POST = route(AUTHOR_ONLY, async ({ req, session }) => {
  const input = createTicketSchema.parse(await readJson(req));
  const ticket = await createTicket(session, input);
  // Classification happens after the response is sent; the queue picks up the labels via SSE.
  after(() => classifyAndStore(ticket.id).catch((e) => console.error("[tickets] classification failed", e)));
  return NextResponse.json({ data: ticket }, { status: 201 });
});
