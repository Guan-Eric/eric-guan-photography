import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { Membership } from "@/lib/db/schema";

const codeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
const BONUS_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

export async function getOrCreatePhotographerReferralCode(userId: string) {
  const db = getDb();
  const existing = await qGet<{ id: string; userId: string; code: string }>(
    db
      .select()
      .from(schema.referralCodes)
      .where(eq(schema.referralCodes.userId, userId)),
  );
  if (existing) return existing;

  const row = {
    id: `ref_${codeId()}`,
    userId,
    code: codeId(),
    createdAt: nowIso(),
  };
  await qRun(db.insert(schema.referralCodes).values(row));
  return row;
}

export async function getReferralByCode(code: string) {
  const db = getDb();
  const normalized = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    (await qGet<{ id: string; userId: string; code: string }>(
      db
        .select()
        .from(schema.referralCodes)
        .where(eq(schema.referralCodes.code, normalized)),
    )) ?? null
  );
}

/**
 * Called after a new photographer signs up with a referral code.
 * Extends trial by 30 days for both the new tenant and the referrer's tenant.
 */
export async function applyReferralOnSignup(
  referralCode: string,
  newTenantId: string,
) {
  const referral = await getReferralByCode(referralCode);
  if (!referral) return { applied: false as const };

  const db = getDb();

  // Extend the new tenant's trial
  const newTenantRow = await qGet<{ id: string; trialEndsAt: string | null }>(
    db.select().from(schema.tenants).where(eq(schema.tenants.id, newTenantId)),
  );
  if (newTenantRow) {
    const currentEnd = newTenantRow.trialEndsAt
      ? new Date(newTenantRow.trialEndsAt)
      : new Date();
    const newEnd = addDays(currentEnd, BONUS_DAYS);
    await qRun(
      db
        .update(schema.tenants)
        .set({ trialEndsAt: newEnd.toISOString() })
        .where(eq(schema.tenants.id, newTenantId)),
    );
  }

  // Apply to all studios this referrer belongs to (single user can have multiple studios).
  const memberships = await qAll<Membership>(
    db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, referral.userId)),
  );
  const tenantIds = [...new Set(memberships.map((row) => row.tenantId))];
  for (const tenantId of tenantIds) {
    const referrerTenant = await qGet<{ id: string; trialEndsAt: string | null }>(
      db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)),
    );
    if (!referrerTenant) continue;
    const currentEnd = referrerTenant.trialEndsAt
      ? new Date(referrerTenant.trialEndsAt)
      : new Date();
    const newEnd = addDays(currentEnd, BONUS_DAYS);
    await qRun(
      db
        .update(schema.tenants)
        .set({ trialEndsAt: newEnd.toISOString() })
        .where(eq(schema.tenants.id, tenantId)),
    );
  }

  // Record the credit for audit
  await qRun(
    db.insert(schema.referralCredits).values({
      id: `rcr_${codeId()}`,
      referralCodeId: referral.id,
      referrerUserId: referral.userId,
      newTenantId,
      bonusDays: BONUS_DAYS,
      createdAt: nowIso(),
    }),
  );

  return { applied: true as const, bonusDays: BONUS_DAYS };
}
