import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/services/authService";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { toErrorResponse } from "@/server/http/errors";
import { readJson } from "@/server/http/route";

// Public route: the only endpoint (besides logout and docs) that doesn't go through route().
export async function POST(req: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await readJson(req));
    const session = await authenticate(email, password);
    const res = NextResponse.json({ user: { id: session.userId, name: session.name, role: session.role } });
    res.cookies.set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
