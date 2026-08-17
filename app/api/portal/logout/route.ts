import { NextResponse } from "next/server";
import { clearAgentSession } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearAgentSession(response);
  return response;
}
