import { beforeAll, describe, expect, it } from "vitest";
import {
  applyReferralOnBooking,
  getOrCreateReferralCode,
  getReferralByCode,
  listOpenReferralCredits,
} from "@/lib/referrals";
import { getTenant } from "@/lib/tenants";
import { ensureTestDb } from "../helpers/db";

describe("referrals", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("creates a stable code and credits the referrer on a later booking", async () => {
    const tenant = await getTenant("eric-guan");
    const referrer = `ref-${Date.now()}@example.com`;
    const friend = `friend-${Date.now()}@example.com`;

    const first = await getOrCreateReferralCode(tenant.id, referrer);
    const again = await getOrCreateReferralCode(tenant.id, referrer);
    expect(again.code).toBe(first.code);
    expect(await getReferralByCode(tenant.id, first.code.toUpperCase())).toBeTruthy();

    const credited = await applyReferralOnBooking({
      tenantId: tenant.id,
      orderId: `ord_ref_${Date.now()}`,
      agentEmail: friend,
      referralCode: first.code,
      currency: "CAD",
    });
    expect(credited.credited).toBe(false);

    const open = await listOpenReferralCredits(tenant.id, referrer);
    expect(open.length).toBeGreaterThan(0);

    const applied = await applyReferralOnBooking({
      tenantId: tenant.id,
      orderId: `ord_apply_${Date.now()}`,
      agentEmail: referrer,
      currency: "CAD",
    });
    expect(applied.credited).toBe(true);
    expect(applied.amountCents).toBe(2500);
    expect(await listOpenReferralCredits(tenant.id, referrer)).toHaveLength(0);
  });
});
