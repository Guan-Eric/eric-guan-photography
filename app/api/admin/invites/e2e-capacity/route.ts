import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { applyPlanToTenant } from "@/lib/billing";

export const runtime = "nodejs";

/** Dev/E2E only — bumps seat quota so team-invite tests can send editor invites. */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available." }, { status: 404 });
  }

  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  if (auth.membership.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the owner can change seats." }, { status: 403 });
  }

  await applyPlanToTenant(session.activeTenantId, "growth", { status: "trialing" });
  return NextResponse.json({ ok: true, seatsQuota: 3 });
}
