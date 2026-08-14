import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/lib/db";
import type { ConnectStatus, TenantRow } from "@/lib/db/schema";
import type { Tenant } from "@/lib/tenant-schema";
import { studioOrigin } from "@/lib/platform";
import { buildStudioConfig } from "@/lib/studio-defaults";

const slugAlphabet = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

function nowIso() {
  return new Date().toISOString();
}

export function parseTenantConfig(row: TenantRow): Tenant {
  return JSON.parse(row.configJson) as Tenant;
}

export function getTenantRow(tenantId: string) {
  const db = getDb();
  return (
    db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).get() ??
    null
  );
}

export function getTenantRowBySlug(slug: string) {
  const db = getDb();
  return (
    db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).get() ??
    null
  );
}

export function getTenantRowByDomain(domain: string) {
  const db = getDb();
  return (
    db.select().from(schema.tenants).where(eq(schema.tenants.domain, domain)).get() ??
    null
  );
}

export function listTenantRows(): TenantRow[] {
  const db = getDb();
  return db.select().from(schema.tenants).all();
}

export function tenantFromRow(row: TenantRow): Tenant {
  const config = parseTenantConfig(row);
  return {
    ...config,
    id: row.id,
    slug: row.slug,
    domain: row.domain,
  };
}

export function createTenantFromOnboarding(options: {
  studioName: string;
  photographerName: string;
  email: string;
  slug?: string;
  timezone?: string;
  accent?: string;
}) {
  const db = getDb();
  const baseSlug =
    options.slug?.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
    options.studioName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) ||
    `studio${slugAlphabet()}`;

  let slug = baseSlug;
  let attempt = 0;
  while (getTenantRowBySlug(slug)) {
    attempt += 1;
    slug = `${baseSlug}${attempt}`;
  }

  const id = `ten_${slugAlphabet()}`;
  const siteUrl = studioOrigin({ slug });

  const tenant = buildStudioConfig({
    id,
    slug,
    studioName: options.studioName.trim(),
    photographerName: options.photographerName.trim(),
    email: options.email.trim().toLowerCase(),
    accent: options.accent,
  });
  tenant.siteUrl = siteUrl;

  const createdAt = nowIso();
  const year = new Date().getUTCFullYear();
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  db.insert(schema.tenants)
    .values({
      id,
      slug,
      domain: null,
      timezone: options.timezone ?? "America/Toronto",
      configJson: JSON.stringify(tenant),
      stripeConnectStatus: "not_started",
      storageBytesUsed: 0,
      mediaQuotaBytes: 10_737_418_240,
      plan: "trial",
      subscriptionStatus: "trialing",
      trialEndsAt: trialEnd,
      listingQuotaAnnual: 100,
      seatsQuota: 1,
      listingsUsedYear: 0,
      listingsYear: year,
      createdAt,
      updatedAt: createdAt,
    })
    .run();

  return { tenant, row: getTenantRow(id)! };
}

export function updateTenantConnect(
  tenantId: string,
  options: { accountId?: string; status: ConnectStatus },
) {
  const db = getDb();
  db.update(schema.tenants)
    .set({
      stripeConnectAccountId: options.accountId,
      stripeConnectStatus: options.status,
      updatedAt: nowIso(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
}

export function setTenantDomain(tenantId: string, domain: string | null) {
  const db = getDb();
  db.update(schema.tenants)
    .set({ domain, updatedAt: nowIso() })
    .where(eq(schema.tenants.id, tenantId))
    .run();
}

export function addTenantStorageUsage(tenantId: string, bytes: number) {
  const db = getDb();
  const row = getTenantRow(tenantId);
  if (!row) return;
  db.update(schema.tenants)
    .set({
      storageBytesUsed: Math.max(0, row.storageBytesUsed + bytes),
      updatedAt: nowIso(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
}

export function platformFeeAmountCents(amountCents: number) {
  const bps = Number(process.env.PLATFORM_FEE_BPS ?? "0");
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.floor((amountCents * bps) / 10_000);
}

export function updateTenantConfig(tenantId: string, patch: Partial<Tenant>) {
  const row = getTenantRow(tenantId);
  if (!row) return null;
  const config = { ...parseTenantConfig(row), ...patch, id: row.id, slug: row.slug, domain: row.domain };
  const db = getDb();
  db.update(schema.tenants)
    .set({ configJson: JSON.stringify(config), updatedAt: nowIso() })
    .where(eq(schema.tenants.id, tenantId))
    .run();
  return getTenantRow(tenantId);
}
