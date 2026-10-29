import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http/errors";
import type { Session } from "@/server/auth/session";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Jm3pFtEJ1K5H9rQy2vB6p1oZ2V1e";

export async function authenticate(email: string, password: string): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email }, include: { author: { select: { id: true } } } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError("UNAUTHENTICATED", "Email or password is incorrect");
  return { userId: user.id, role: user.role, name: user.name, authorId: user.author?.id };
}
