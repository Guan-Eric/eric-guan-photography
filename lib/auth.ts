import { and, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/lib/db";
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
    db.select().from(schema.users).where(eq(schema.users.id, parsed.userId)).get() ??
    null;
  if (!user) return null;

  const memberships = db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, user.id))
    .all();

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

export function registerUser(options: {
  email: string;
  password: string;
  name: string;
}) {
  const db = getDb();
  const email = options.email.trim().toLowerCase();
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
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
  db.insert(schema.users).values(user).run();
  return { ok: true as const, user };
}

export function authenticateUser(email: string, password: string) {
  const db = getDb();
  const user =
    db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.trim().toLowerCase()))
      .get() ?? null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Wrong email or password." };
  }
  return { ok: true as const, user };
}

export function createMembership(options: {
  userId: string;
  tenantId: string;
  role?: MembershipRole;
}) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.userId, options.userId),
        eq(schema.memberships.tenantId, options.tenantId),
      ),
    )
    .get();
  if (existing) return existing;

  const row = {
    id: `mem_${id()}`,
    userId: options.userId,
    tenantId: options.tenantId,
    role: options.role ?? "owner",
    createdAt: new Date().toISOString(),
  };
  db.insert(schema.memberships).values(row).run();
  return row;
}
