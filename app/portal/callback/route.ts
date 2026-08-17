import { NextResponse } from "next/server";
import { attachAgentSession, consumeAgentLoginToken } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const login = new URL("/portal/login", url.origin);
  if (!token) return NextResponse.redirect(login);
  const session = await consumeAgentLoginToken(token);
  if (!session) return NextResponse.redirect(login);
  const response = NextResponse.redirect(new URL("/portal", url.origin));
  await attachAgentSession(response, session);
  return response;
}
