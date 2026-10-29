import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError("NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have access to this resource") => new ApiError("FORBIDDEN", msg);

/** Every error leaves the API in the same shape: { error: { code, message, details? } }. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: STATUS[err.code] },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Request body is not valid JSON" } },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Record not found" } }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}
