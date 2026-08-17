import { and, eq, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { ReferralCode, ReferralCredit } from "@/lib/db/schema";

const codeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
const creditNano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const REFERRAL_CREDIT_CENTS = 2500;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCode(code: string) {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function getOrCreateReferralCode(tenantId: string, agentEmail: string) {
  const email = normalizeEmail(agentEmail);
  const db = getDb();
  const existing =
    (await qGet<ReferralCode>(
      db
        .select()
        .from(schema.referralCodes)
        .where(
          and(
            eq(schema.referralCodes.tenantId, tenantId),
            eq(schema.referralCodes.agentEmail, email),
          ),
        ),
    )) ?? null;
  if (existing) return existing;

  const createdAt = nowIso();
  const row = {
    id: `ref_${codeId()}`,
    tenantId,
    agentEmail: email,
    code: codeId(),
    createdAt,
  };
  await qRun(db.insert(schema.referralCodes).values(row));
  return row;
}

export async function getReferralByCode(tenantId: string, code: string) {
  const db = getDb();
  return (
    (await qGet<ReferralCode>(
      db
        .select()
        .from(schema.referralCodes)
        .where(
          and(
            eq(schema.referralCodes.tenantId, tenantId),
            eq(schema.referralCodes.code, normalizeCode(code)),
          ),
        ),
    )) ?? null
  );
}

export async function listOpenReferralCredits(tenantId: string, agentEmail: string) {
  const db = getDb();
  const rows = await qAll<ReferralCredit>(
    db
      .select()
      .from(schema.referralCredits)
      .where(
        and(
          eq(schema.referralCredits.tenantId, tenantId),
          eq(schema.referralCredits.agentEmail, normalizeEmail(agentEmail)),
        ),
      ),
  );
  return rows.filter((row) => !row.appliedOrderId);
}

export async function applyReferralOnBooking(options: {
  tenantId: string;
  orderId: string;
  agentEmail: string;
  referralCode?: string;
  currency: string;
}) {
  const email = normalizeEmail(options.agentEmail);
  await getOrCreateReferralCode(options.tenantId, email);

  if (options.referralCode) {
    const code = await getReferralByCode(options.tenantId, options.referralCode);
    if (code && code.agentEmail !== email) {
      const db = getDb();
      await qRun(
        db.insert(schema.referralCredits).values({
          id: `rcr_${creditNano()}`,
          tenantId: options.tenantId,
          agentEmail: code.agentEmail,
          amountCents: REFERRAL_CREDIT_CENTS,
          currency: options.currency,
          sourceOrderId: options.orderId,
          appliedOrderId: null,
          createdAt: nowIso(),
        }),
      );
    }
  }

  const open = await listOpenReferralCredits(options.tenantId, email);
  const first = open[0];
  if (!first) return { credited: false as const, amountCents: 0 };

  const db = getDb();
  await qRun(
    db
      .update(schema.referralCredits)
      .set({ appliedOrderId: options.orderId })
      .where(eq(schema.referralCredits.id, first.id)),
  );
  return { credited: true as const, amountCents: first.amountCents };
}
