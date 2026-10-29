import { NextResponse } from "next/server";
import { openapi } from "@/server/http/openapi";

// Public: documentation only, no data.
export function GET() {
  return NextResponse.json(openapi);
}
