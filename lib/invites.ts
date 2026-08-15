import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { createMembership } from "@/lib/auth";
import { assertCanInviteSeat } from "@/lib/billing";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { MembershipInvite, MembershipRole } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { platformName } from "@/lib/platform";

const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);
const rowId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

function nowIso() {
  return new Date().toISOString();
}

export async function listInvites(tenantId: string) {
  const db = getDb();
  return qAll<MembershipInvite>(
    db
      .select()
      .from(schema.membershipInvites)
      .where(eq(schema.membershipInvites.tenantId, tenantId)),
  );
}

export async function getInviteByToken(token: string) {
  const db = getDb();
  return (
    (await qGet<MembershipInvite>(
      db
        .select()
        .from(schema.membershipInvites)
        .where(eq(schema.membershipInvites.token, token)),
    )) ?? null
  );
}

export async function createInvite(options: {
  tenantId: string;
  email: string;
  role: MembershipRole;
  invitedByUserId: string;
  acceptUrl: string;
}) {
  const seats = await assertCanInviteSeat(options.tenantId);
  if (!seats.ok) return seats;

  const email = options.email.trim().toLowerCase();
  const db = getDb();
  const existing = await qGet<MembershipInvite>(
    db
      .select()
      .from(schema.membershipInvites)
      .where(
        and(
          eq(schema.membershipInvites.tenantId, options.tenantId),
          eq(schema.membershipInvites.email, email),
        ),
      ),
  );
  if (existing && !existing.acceptedAt) {
    return { ok: true as const, invite: existing, resent: true as const };
  }

  const createdAt = nowIso();
  const invite = {
    id: `inv_${rowId()}`,
    tenantId: options.tenantId,
    email,
    role: options.role,
    token: tokenId(),
    invitedByUserId: options.invitedByUserId,
    acceptedAt: null,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt,
  };
  await qRun(db.insert(schema.membershipInvites).values(invite));

  await sendEmail({
    to: email,
    subject: `You're invited to a studio on ${platformName()}`,
    text: [
      `You've been invited as ${options.role}.`,
      "",
      `Accept: ${options.acceptUrl.replace("TOKEN", invite.token)}`,
      "",
      "This link expires in 14 days.",
    ].join("\n"),
  });

  return { ok: true as const, invite, resent: false as const };
}

export async function acceptInvite(options: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const invite = await getInviteByToken(options.token);
  if (!invite) return { ok: false as const, error: "Invite not found." };
  if (invite.acceptedAt) return { ok: false as const, error: "Invite already used." };
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "Invite expired." };
  }
  if (invite.email !== options.userEmail.trim().toLowerCase()) {
    return { ok: false as const, error: "Sign in with the invited email address." };
  }

  await createMembership({
    userId: options.userId,
    tenantId: invite.tenantId,
    role: invite.role,
  });

  const db = getDb();
  await qRun(
    db
      .update(schema.membershipInvites)
      .set({ acceptedAt: nowIso() })
      .where(eq(schema.membershipInvites.id, invite.id)),
  );

  return { ok: true as const, tenantId: invite.tenantId };
}
