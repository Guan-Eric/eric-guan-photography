import { NextResponse } from "next/server";
import { attachPhotographerSession, authenticateUser } from "@/lib/auth";
import { getDb, qGet, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { rateLimitAuth } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimitAuth(request, "login");
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const result = await authenticateUser(email, password);
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  const membership = await qGet<{ tenantId: string }>(
    getDb()
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, result.user.id)),
  );

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.json({
    ok: true,
    hasStudio: Boolean(membership?.tenantId),
  });
  attachPhotographerSession(response, result.user.id, membership?.tenantId, host);
  return response;
}
