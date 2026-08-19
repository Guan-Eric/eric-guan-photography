import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { billingSummary } from "@/lib/billing";
import { countBillableDomains } from "@/lib/domain-billing";
import { getOrCreatePhotographerReferralCode } from "@/lib/referrals";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  const row = await getTenantRow(session.activeTenantId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }
  const activeDomains = await countBillableDomains(row.id);
  let referralCode: string | null = null;
  try {
    const referral = await getOrCreatePhotographerReferralCode(session.user.id);
    referralCode = referral.code;
  } catch (error) {
    // Avoid breaking Settings if referral tables are mid-migration.
    console.warn("[billing] referral lookup failed:", error);
  }
  return NextResponse.json({
    ok: true,
    ...billingSummary(row, { activeDomains }),
    referralCode,
  });
}
