import { and, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { Membership, MembershipRole, User } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordIssues } from "@/lib/password-rules";
import { cookieDomain } from "@/lib/platform";

const SESSION_COOKIE = "eg_photographer_session";
const ACTIVE_TENANT_COOKIE = "eg_active_tenant";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

function secret() {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.ADMIN_SESSION_SECRET ??
    "dev-auth-secret-change-me"
  );
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function sessionSecure() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    process.env.NODE_ENV === "production" &&
    !siteUrl.startsWith("http://") &&
    process.env.ADMIN_COOKIE_INSECURE !== "1"
  );
}

function sessionCookieOptions() {
  const domain = cookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

export type PhotographerSession = {
  user: User;
  memberships: Membership[];
  activeTenantId: string | null;
};

export async function createPhotographerSession(userId: string, tenantId?: string) {
  const issuedAt = Date.now().toString();
  const payload = `${userId}.${issuedAt}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, sessionCookieOptions());
  if (tenantId) {
    jar.set(ACTIVE_TENANT_COOKIE, tenantId, sessionCookieOptions());
  }
}

export async function clearPhotographerSession() {
  const jar = await cookies();
  const expired = { ...sessionCookieOptions(), maxAge: 0 };
  jar.set(SESSION_COOKIE, "", expired);
  jar.set(ACTIVE_TENANT_COOKIE, "", expired);
}

export async function setActiveTenantCookie(tenantId: string) {
  const jar = await cookies();
  const opts = sessionCookieOptions();
  jar.set(ACTIVE_TENANT_COOKIE, tenantId, opts);
}

function parseSessionCookie(raw: string | undefined) {
  if (!raw) return null;
  const [userId, issuedAt, signature] = raw.split(".");
  if (!userId || !issuedAt || !signature) return null;
  const expected = sign(`${userId}.${issuedAt}`);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const ageMs = Date.now() - Number(issuedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= MAX_AGE_SECONDS * 1000) {
    return null;
  }
  return { userId };
}

export async function getPhotographerSession(): Promise<PhotographerSession | null> {
  const jar = await cookies();
  const parsed = parseSessionCookie(jar.get(SESSION_COOKIE)?.value);
  if (!parsed) return null;

  const db = getDb();
  const user =
    (await qGet<User>(
      db.select().from(schema.users).where(eq(schema.users.id, parsed.userId)),
    )) ?? null;
  if (!user) return null;

  const memberships = await qAll<Membership>(
    db.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id)),
  );

  const activeFromCookie = jar.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  const activeTenantId =
    memberships.find((row) => row.tenantId === activeFromCookie)?.tenantId ??
    memberships[0]?.tenantId ??
    null;

  return { user, memberships, activeTenantId };
}

export async function requirePhotographerSession() {
  const session = await getPhotographerSession();
  if (!session) return { ok: false as const, error: "Unauthorized." };
  return { ok: true as const, session };
}

export async function requireTenantMembership(tenantId: string) {
  const auth = await requirePhotographerSession();
  if (!auth.ok) return auth;
  const membership = auth.session.memberships.find((row) => row.tenantId === tenantId);
  if (!membership) {
    return { ok: false as const, error: "No access to this studio." };
  }
  return { ok: true as const, session: auth.session, membership };
}

export async function registerUser(options: {
  email: string;
  password: string;
  name: string;
}) {
  const db = getDb();
  const email = options.email.trim().toLowerCase();
  const existing = await qGet<User>(
    db.select().from(schema.users).where(eq(schema.users.email, email)),
  );
  if (existing) {
    return { ok: false as const, error: "An account with that email already exists." };
  }
  const issues = passwordIssues(options.password);
  if (issues.length > 0) {
    return { ok: false as const, error: `Password: ${issues[0]!.toLowerCase()}.` };
  }

  const createdAt = new Date().toISOString();
  const user = {
    id: `usr_${id()}`,
    email,
    passwordHash: hashPassword(options.password),
    name: options.name.trim(),
    createdAt,
    updatedAt: createdAt,
  };
  await qRun(db.insert(schema.users).values(user));
  return { ok: true as const, user };
}

export async function authenticateUser(email: string, password: string) {
  const db = getDb();
  const user =
    (await qGet<User>(
      db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.trim().toLowerCase())),
    )) ?? null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Wrong email or password." };
  }
  return { ok: true as const, user };
}

export async function requestPasswordReset(email: string, origin: string) {
  const db = getDb();
  const user =
    (await qGet<User>(
      db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.trim().toLowerCase())),
    )) ?? null;

  // Always succeed from the caller's perspective to avoid email enumeration.
  if (!user) {
    return { ok: true as const };
  }

  const token = `rst_${id()}${id()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await qRun(
    db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, user.id)),
  );
  await qRun(
    db.insert(schema.passwordResetTokens).values({
      id: `prt_${id()}`,
      userId: user.id,
      token,
      expiresAt,
      createdAt,
    }),
  );

  const { sendEmail } = await import("@/lib/email");
  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    text: `Reset your password within one hour:\n\n${origin}/reset-password?token=${token}\n\nIf you did not ask for this, ignore this email.`,
  });

  return { ok: true as const };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const issues = passwordIssues(password);
  if (issues.length > 0) {
    return { ok: false as const, error: `Password: ${issues[0]!.toLowerCase()}.` };
  }

  const db = getDb();
  const row =
    (await qGet<{ userId: string; expiresAt: string }>(
      db
        .select()
        .from(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, token)),
    )) ?? null;
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "This reset link is invalid or expired." };
  }

  await qRun(
    db
      .update(schema.users)
      .set({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, row.userId)),
  );
  await qRun(
    db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, row.userId)),
  );

  return { ok: true as const };
}

export async function createMembership(options: {
  userId: string;
  tenantId: string;
  role?: MembershipRole;
}) {
  const db = getDb();
  const existing = await qGet<Membership>(
    db
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.userId, options.userId),
          eq(schema.memberships.tenantId, options.tenantId),
        ),
      ),
  );
  if (existing) return existing;

  const row = {
    id: `mem_${id()}`,
    userId: options.userId,
    tenantId: options.tenantId,
    role: options.role ?? "owner",
    createdAt: new Date().toISOString(),
  };
  await qRun(db.insert(schema.memberships).values(row));
  return row;
}
