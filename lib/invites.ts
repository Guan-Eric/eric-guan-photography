import { and, eq, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { createMembership } from "@/lib/auth";
import { assertCanInviteSeat } from "@/lib/billing";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { MembershipInvite, MembershipRole } from "@/lib/db/schema";
import { sendEmail, studioInviteEmail } from "@/lib/email";
import { getTenantRow } from "@/lib/tenant-store";

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

export async function listPendingInvites(tenantId: string) {
  const db = getDb();
  return qAll<MembershipInvite>(
    db
      .select()
      .from(schema.membershipInvites)
      .where(
        and(
          eq(schema.membershipInvites.tenantId, tenantId),
          isNull(schema.membershipInvites.acceptedAt),
        ),
      ),
  );
}

export async function listTeamMembers(tenantId: string) {
  const db = getDb();
  return qAll<{
    id: string;
    userId: string;
    email: string;
    name: string;
    role: MembershipRole;
    createdAt: string;
  }>(
    db
      .select({
        id: schema.memberships.id,
        userId: schema.memberships.userId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.memberships.role,
        createdAt: schema.memberships.createdAt,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(eq(schema.memberships.tenantId, tenantId)),
  );
}

export async function revokeInvite(tenantId: string, inviteId: string) {
  const db = getDb();
  const invite =
    (await qGet<MembershipInvite>(
      db
        .select()
        .from(schema.membershipInvites)
        .where(
          and(
            eq(schema.membershipInvites.id, inviteId),
            eq(schema.membershipInvites.tenantId, tenantId),
          ),
        ),
    )) ?? null;
  if (!invite) return { ok: false as const, error: "Invite not found." };
  if (invite.acceptedAt) {
    return { ok: false as const, error: "That invite was already accepted." };
  }
  await qRun(
    db.delete(schema.membershipInvites).where(eq(schema.membershipInvites.id, inviteId)),
  );
  return { ok: true as const };
}

export async function removeTeamMember(options: {
  tenantId: string;
  membershipId: string;
  actorUserId: string;
}) {
  const db = getDb();
  const membership =
    (await qGet<{ id: string; userId: string; role: MembershipRole }>(
      db
        .select({
          id: schema.memberships.id,
          userId: schema.memberships.userId,
          role: schema.memberships.role,
        })
        .from(schema.memberships)
        .where(
          and(
            eq(schema.memberships.id, options.membershipId),
            eq(schema.memberships.tenantId, options.tenantId),
          ),
        ),
    )) ?? null;
  if (!membership) return { ok: false as const, error: "Team member not found." };
  if (membership.role === "owner") {
    return { ok: false as const, error: "Cannot remove the studio owner." };
  }
  if (membership.userId === options.actorUserId) {
    return { ok: false as const, error: "You cannot remove yourself." };
  }
  await qRun(
    db.delete(schema.memberships).where(eq(schema.memberships.id, options.membershipId)),
  );
  return { ok: true as const };
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

export function inviteAcceptanceError(invite: MembershipInvite | null, email: string) {
  if (!invite) return "Invite not found or expired.";
  if (invite.acceptedAt) return "This invite was already used.";
  if (new Date(invite.expiresAt).getTime() < Date.now()) return "This invite expired.";
  const normalized = email.trim().toLowerCase();
  if (invite.email !== normalized) {
    return `Use ${invite.email} — that's the address this invite was sent to.`;
  }
  return null;
}

export function isInviteEmailMismatch(invite: MembershipInvite | null, userEmail: string) {
  if (!invite || invite.acceptedAt) return false;
  if (new Date(invite.expiresAt).getTime() < Date.now()) return false;
  return invite.email !== userEmail.trim().toLowerCase();
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
    const tenant = await getTenantRow(options.tenantId);
    let studioName: string | undefined;
    try {
      studioName = tenant
        ? (JSON.parse(tenant.configJson) as { studioName?: string }).studioName
        : undefined;
    } catch {
      studioName = undefined;
    }
    await sendEmail(
      studioInviteEmail({
        to: email,
        role: existing.role,
        acceptUrl: options.acceptUrl.replace("TOKEN", existing.token),
        studioName,
      }),
    );
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

  const tenant = await getTenantRow(options.tenantId);
  let studioName: string | undefined;
  try {
    studioName = tenant
      ? (JSON.parse(tenant.configJson) as { studioName?: string }).studioName
      : undefined;
  } catch {
    studioName = undefined;
  }

  await sendEmail(
    studioInviteEmail({
      to: email,
      role: options.role,
      acceptUrl: options.acceptUrl.replace("TOKEN", invite.token),
      studioName,
    }),
  );

  return { ok: true as const, invite, resent: false as const };
}

export async function acceptInvite(options: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const invite = await getInviteByToken(options.token);
  const validationError = inviteAcceptanceError(invite, options.userEmail);
  if (validationError) {
    return { ok: false as const, error: validationError };
  }

  await createMembership({
    userId: options.userId,
    tenantId: invite!.tenantId,
    role: invite!.role,
  });

  const db = getDb();
  await qRun(
    db
      .update(schema.membershipInvites)
      .set({ acceptedAt: nowIso() })
      .where(eq(schema.membershipInvites.id, invite!.id)),
  );

  return { ok: true as const, tenantId: invite!.tenantId };
}
