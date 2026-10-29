import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

/**
 * Page-level guard: sends people to the right portal for their role.
 * API routes do their own checks in route(); this only protects page navigation.
 */
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const home = session?.role === "ADMIN" ? "/admin/tickets" : "/author/books";

  if (pathname === "/" || pathname === "/login") {
    return session ? NextResponse.redirect(new URL(home, req.url)) : pathname === "/" ? NextResponse.redirect(new URL("/login", req.url)) : NextResponse.next();
  }
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const wantsAdmin = pathname.startsWith("/admin");
  if (wantsAdmin !== (session.role === "ADMIN")) return NextResponse.redirect(new URL(home, req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/author/:path*", "/admin/:path*"] };
