import { NextResponse } from "next/server";
import { clearAgentSession } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.json({ ok: true });
  await clearAgentSession(response, host);
  return response;
}
