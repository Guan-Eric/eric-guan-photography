import { NextResponse } from "next/server";
import { attachAgentSession, consumeAgentLoginToken } from "@/lib/agent-auth";
import { requestPublicOrigin } from "@/lib/platform";

export const runtime = "nodejs";

async function tokenFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    return typeof body?.token === "string" ? body.token : "";
  }
  const form = await request.formData().catch(() => null);
  const value = form?.get("token");
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const origin = requestPublicOrigin(request);
  const login = new URL("/portal/login?error=expired", origin);
  const token = (await tokenFromRequest(request)).trim();
  if (!token) return NextResponse.redirect(login);
  const session = await consumeAgentLoginToken(token);
  if (!session) return NextResponse.redirect(login);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.redirect(new URL("/portal", origin));
  await attachAgentSession(response, session, host);
  return response;
}
