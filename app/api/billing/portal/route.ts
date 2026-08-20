import { NextResponse } from "next/server";
import { getPhotographerSession } from "@/lib/auth";
import { requireStudioOwner } from "@/lib/admin-guards";
import { createBillingPortalSession } from "@/lib/billing";
import { requestPublicOrigin } from "@/lib/platform";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  const owner = await requireStudioOwner(session.activeTenantId);
  if (!owner.ok) {
    return NextResponse.json({ ok: false, error: owner.error }, { status: 403 });
  }

  const origin = requestPublicOrigin(request);
  const result = await createBillingPortalSession(
    session.activeTenantId,
    `${origin}/admin/settings`,
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: result.stubbed ? 501 : 400 });
  }
  return NextResponse.json(result);
}
