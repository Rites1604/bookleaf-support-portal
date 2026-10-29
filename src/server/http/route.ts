import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE, verifySession, type Session } from "@/server/auth/session";
import { ApiError, toErrorResponse } from "./errors";

type Ctx<P> = { req: NextRequest; session: Session; params: P };
type Handler<P> = (ctx: Ctx<P>) => Promise<NextResponse | Response>;

/**
 * Wraps every protected route: resolves the session, enforces roles and turns thrown
 * errors into the standard error shape. Route files stay focused on parse → service → respond.
 */
export function route<P = Record<string, string>>(roles: Role[], handler: Handler<P>) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    try {
      const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
      if (!session) throw new ApiError("UNAUTHENTICATED", "Please log in to continue");
      if (!roles.includes(session.role)) throw new ApiError("FORBIDDEN", "Your role cannot access this endpoint");
      return await handler({ req, session, params: await params });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export const ANY_ROLE: Role[] = ["AUTHOR", "ADMIN"];
export const ADMIN_ONLY: Role[] = ["ADMIN"];
export const AUTHOR_ONLY: Role[] = ["AUTHOR"];

export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}
