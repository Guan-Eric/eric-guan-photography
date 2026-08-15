import { NextResponse } from "next/server";
import {
  authenticateUser,
  createPhotographerSession,
  setActiveTenantCookie,
} from "@/lib/auth";
import { getDb, qGet, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  await createPhotographerSession(result.user.id, membership?.tenantId);
  if (membership?.tenantId) {
    await setActiveTenantCookie(membership.tenantId);
  }

  return NextResponse.json({
    ok: true,
    hasStudio: Boolean(membership?.tenantId),
  });
}
