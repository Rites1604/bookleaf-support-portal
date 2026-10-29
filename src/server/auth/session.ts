import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "bl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working day

export type Session = {
  userId: string;
  role: Role;
  name: string;
  /** Present only for authors; scopes every author query. */
  authorId?: string;
};

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as string,
      role: payload.role as Role,
      name: payload.name as string,
      authorId: payload.authorId as string | undefined,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
