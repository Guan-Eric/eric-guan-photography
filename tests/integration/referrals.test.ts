import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "@/lib/auth";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import {
  applyReferralOnSignup,
  getOrCreatePhotographerReferralCode,
  getReferralByCode,
} from "@/lib/referrals";
import { getTenant } from "@/lib/tenants";
import { ensureTestDb } from "../helpers/db";

describe("photographer referrals", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("creates a stable code per user", async () => {
    const tenant = await getTenant("eric-guan");
    const db = getDb();

    const userId = `usr_reftest_${Date.now()}`;
    await qRun(
      db.insert(schema.users).values({
        id: userId,
        email: `reftest-${Date.now()}@example.com`,
        passwordHash: "x",
        name: "Ref Test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const first = await getOrCreatePhotographerReferralCode(userId);
    const again = await getOrCreatePhotographerReferralCode(userId);
    expect(again.code).toBe(first.code);

    const found = await getReferralByCode(first.code);
    expect(found).toBeTruthy();
    expect(found!.userId).toBe(userId);

    const upper = await getReferralByCode(first.code.toUpperCase());
    expect(upper).toBeTruthy();
  });

  it("extends trial for both referrer and new tenant on signup", async () => {
    const db = getDb();
    const now = new Date();

    const referrerUserId = `usr_referrer_${Date.now()}`;
    await qRun(
      db.insert(schema.users).values({
        id: referrerUserId,
        email: `referrer-${Date.now()}@example.com`,
        passwordHash: "x",
        name: "Referrer",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    );

    const referrerTenantId = `ten_referrer_${Date.now()}`;
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60_000).toISOString();
    await qRun(
      db.insert(schema.tenants).values({
        id: referrerTenantId,
        slug: `ref-studio-${Date.now()}`,
        studioName: "Referrer Studio",
        photographerName: "Referrer",
        email: `referrer-${Date.now()}@example.com`,
        configJson: "{}",
        plan: "trial",
        subscriptionStatus: "trialing",
        trialEndsAt: trialEnd,
        mediaQuotaBytes: 10_000_000,
        listingQuotaAnnual: 100,
        seatsQuota: 1,
        listingsUsedYear: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    );
    await qRun(
      db.insert(schema.memberships).values({
        id: `mem_referrer_${Date.now()}`,
        userId: referrerUserId,
        tenantId: referrerTenantId,
        role: "owner",
        createdAt: now.toISOString(),
      }),
    );

    const code = await getOrCreatePhotographerReferralCode(referrerUserId);

    const newTenantId = `ten_new_${Date.now()}`;
    await qRun(
      db.insert(schema.tenants).values({
        id: newTenantId,
        slug: `new-studio-${Date.now()}`,
        studioName: "New Studio",
        photographerName: "Newbie",
        email: `newbie-${Date.now()}@example.com`,
        configJson: "{}",
        plan: "trial",
        subscriptionStatus: "trialing",
        trialEndsAt: trialEnd,
        mediaQuotaBytes: 10_000_000,
        listingQuotaAnnual: 100,
        seatsQuota: 1,
        listingsUsedYear: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    );

    const result = await applyReferralOnSignup(code.code, newTenantId);
    expect(result.applied).toBe(true);
    expect(result.bonusDays).toBe(30);

    const updatedNew = await qGet<{ trialEndsAt: string }>(
      db.select().from(schema.tenants).where(eq(schema.tenants.id, newTenantId)),
    );
    const updatedReferrer = await qGet<{ trialEndsAt: string }>(
      db.select().from(schema.tenants).where(eq(schema.tenants.id, referrerTenantId)),
    );

    const originalEnd = new Date(trialEnd).getTime();
    const thirtyDays = 30 * 24 * 60 * 60_000;
    expect(new Date(updatedNew!.trialEndsAt).getTime()).toBeCloseTo(originalEnd + thirtyDays, -4);
    expect(new Date(updatedReferrer!.trialEndsAt).getTime()).toBeCloseTo(originalEnd + thirtyDays, -4);
  });

  it("returns not applied for an invalid code", async () => {
    const result = await applyReferralOnSignup("nonexistent", "ten_fake");
    expect(result.applied).toBe(false);
  });
});
