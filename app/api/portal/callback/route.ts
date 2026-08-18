import { NextResponse } from "next/server";
import { attachAgentSession, consumeAgentLoginToken } from "@/lib/agent-auth";
import { requestPublicOrigin, safePortalPath } from "@/lib/platform";

export const runtime = "nodejs";

async function fieldsFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
      next?: unknown;
    } | null;
    return {
      token: typeof body?.token === "string" ? body.token : "",
      next: safePortalPath(body?.next),
    };
  }
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  return {
    token: typeof token === "string" ? token : "",
    next: safePortalPath(form?.get("next")),
  };
}

export async function POST(request: Request) {
  const origin = requestPublicOrigin(request);
  const login = new URL("/portal/login?error=expired", origin);
  const { token, next } = await fieldsFromRequest(request);
  if (!token.trim()) return NextResponse.redirect(login);
  const session = await consumeAgentLoginToken(token.trim());
  if (!session) return NextResponse.redirect(login);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.redirect(new URL(next ?? "/portal", origin));
  await attachAgentSession(response, session, host);
  return response;
}
