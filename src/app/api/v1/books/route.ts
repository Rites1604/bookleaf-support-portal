import { NextResponse } from "next/server";
import { z } from "zod";
import { ANY_ROLE, route } from "@/server/http/route";
import { listBooks } from "@/server/services/bookService";

const query = z.object({ authorId: z.string().optional() });

export const GET = route(ANY_ROLE, async ({ req, session }) => {
  const { authorId } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json({ data: await listBooks(session, authorId) });
});
