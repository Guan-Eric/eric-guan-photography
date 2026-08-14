import { NextResponse } from "next/server";
import { getPhotographerSession } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const result = await createBillingPortalSession(
    session.activeTenantId,
    `${origin}/admin/settings`,
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: result.stubbed ? 501 : 400 });
  }
  return NextResponse.json(result);
}
