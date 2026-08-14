import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ericGuan } from "@/content/tenants/eric-guan";
import { hashPassword } from "@/lib/password";
import * as schema from "@/lib/db/schema";
import { studioOrigin } from "@/lib/platform";
import type { Tenant } from "@/lib/tenant-schema";

type Db = BetterSQLite3Database<typeof schema>;

const DEMO_TENANT: Tenant = {
  ...ericGuan,
  id: "demo-studio",
  slug: "demo",
  domain: null,
  studioName: "Demo Studio",
  photographerName: "Demo Photographer",
  email: "demo@example.com",
  siteUrl: studioOrigin({ slug: "demo" }),
  tagline: "Sample second tenant for isolation tests.",
  lede: "This studio exists so Phase 3 can prove tenant A cannot see tenant B.",
  portfolioComplete: false,
};

function nowIso() {
  return new Date().toISOString();
}

function upsertTenant(db: Db, tenant: Tenant, timezone = "America/Toronto") {
  const existing = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenant.id))
    .get();

  if (existing) {
    return;
  }

  const createdAt = nowIso();
  db.insert(schema.tenants)
    .values({
      id: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      timezone,
      configJson: JSON.stringify(tenant),
      stripeConnectStatus: "not_started",
      storageBytesUsed: 0,
      mediaQuotaBytes: 107_374_182_400,
      plan: "studio",
      subscriptionStatus: "active",
      listingQuotaAnnual: 500,
      seatsQuota: 5,
      listingsUsedYear: 0,
      listingsYear: new Date().getUTCFullYear(),
      createdAt,
      updatedAt: createdAt,
    })
    .run();
}

function ensureUser(
  db: Db,
  options: { id: string; email: string; name: string; password: string },
) {
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, options.email.toLowerCase()))
    .get();
  if (existing) return existing;

  const createdAt = nowIso();
  const row = {
    id: options.id,
    email: options.email.toLowerCase(),
    passwordHash: hashPassword(options.password),
    name: options.name,
    createdAt,
    updatedAt: createdAt,
  };
  db.insert(schema.users).values(row).run();
  return row;
}

function ensureMembership(
  db: Db,
  options: { id: string; userId: string; tenantId: string; role: "owner" | "editor" },
) {
  const existing = db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, options.userId))
    .all()
    .find((row) => row.tenantId === options.tenantId);
  if (existing) return;

  db.insert(schema.memberships)
    .values({
      id: options.id,
      userId: options.userId,
      tenantId: options.tenantId,
      role: options.role,
      createdAt: nowIso(),
    })
    .run();
}

/** Seeds dogfood + demo tenants and default photographer logins. */
export function seedPlatform(db: Db) {
  const password = process.env.ADMIN_PASSWORD ?? "dev-admin";

  upsertTenant(db, ericGuan);
  upsertTenant(db, DEMO_TENANT);

  const ericOwner = ensureUser(db, {
    id: "usr_eric_owner",
    email: process.env.SEED_OWNER_EMAIL ?? "ericguan.photo@gmail.com",
    name: "Eric Guan",
    password,
  });
  ensureMembership(db, {
    id: "mem_eric_owner",
    userId: ericOwner.id,
    tenantId: ericGuan.id,
    role: "owner",
  });

  const demoOwner = ensureUser(db, {
    id: "usr_demo_owner",
    email: "demo@example.com",
    name: "Demo Photographer",
    password,
  });
  ensureMembership(db, {
    id: "mem_demo_owner",
    userId: demoOwner.id,
    tenantId: DEMO_TENANT.id,
    role: "owner",
  });

  for (const tenantId of [ericGuan.id, DEMO_TENANT.id]) {
    db.update(schema.tenants)
      .set({
        plan: "studio",
        subscriptionStatus: "active",
        listingQuotaAnnual: 500,
        seatsQuota: 5,
        mediaQuotaBytes: 107_374_182_400,
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, tenantId))
      .run();
  }
}
