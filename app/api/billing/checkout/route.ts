import { NextResponse } from "next/server";
import { getPhotographerSession } from "@/lib/auth";
import { requireStudioOwner } from "@/lib/admin-guards";
import { createSubscriptionCheckout } from "@/lib/billing";
import { isPurchasablePlan } from "@/lib/db/schema";
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

  const body = await request.json().catch(() => ({}));
  const plan = typeof body?.plan === "string" ? body.plan : "";
  if (!isPurchasablePlan(plan)) {
    return NextResponse.json(
      { ok: false, error: "Choose Pay as you go, Starter, Growth, or Studio." },
      { status: 400 },
    );
  }

  const origin = requestPublicOrigin(request);
  const result = await createSubscriptionCheckout({
    tenantId: session.activeTenantId,
    plan,
    email: session.user.email,
    successUrl: `${origin}/admin/settings?billing=success`,
    cancelUrl: `${origin}/admin/settings?billing=cancelled`,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
