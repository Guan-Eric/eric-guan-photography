import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { ConnectStatus, TenantRow } from "@/lib/db/schema";
import type { Tenant } from "@/lib/tenant-schema";
import { publicStudioUrl, studioOrigin } from "@/lib/platform";
import { buildStudioConfig } from "@/lib/studio-defaults";
import { normalizeTimeZone } from "@/lib/timezones";

const slugAlphabet = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

function nowIso() {
  return new Date().toISOString();
}

export function parseTenantConfig(row: TenantRow): Tenant {
  return JSON.parse(row.configJson) as Tenant;
}

export async function getTenantRow(tenantId: string) {
  const db = getDb();
  return (
    (await qGet<TenantRow>(
      db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)),
    )) ?? null
  );
}

export async function getTenantRowBySlug(slug: string) {
  const db = getDb();
  return (
    (await qGet<TenantRow>(
      db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)),
    )) ?? null
  );
}

export async function getTenantRowByDomain(domain: string) {
  const db = getDb();
  return (
    (await qGet<TenantRow>(
      db.select().from(schema.tenants).where(eq(schema.tenants.domain, domain)),
    )) ?? null
  );
}

export async function listTenantRows(): Promise<TenantRow[]> {
  const db = getDb();
  return qAll<TenantRow>(db.select().from(schema.tenants));
}

export function tenantFromRow(row: TenantRow): Tenant {
  const config = parseTenantConfig(row);
  const siteUrl = publicStudioUrl({
    slug: row.slug,
    domain: row.domain,
    domainStatus: row.domainStatus,
    siteUrl: config.siteUrl,
  });
  return {
    ...config,
    id: row.id,
    slug: row.slug,
    domain: row.domain,
    siteUrl,
  };
}

export async function createTenantFromOnboarding(options: {
  studioName: string;
  photographerName: string;
  email: string;
  slug?: string;
  timezone?: string;
  accent?: string;
  currency?: string;
}) {
  const db = getDb();
  const baseSlug =
    options.slug?.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
    options.studioName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) ||
    `studio${slugAlphabet()}`;

  let slug = baseSlug;
  let attempt = 0;
  while (await getTenantRowBySlug(slug)) {
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
    currency: options.currency,
  });
  tenant.siteUrl = siteUrl;

  const createdAt = nowIso();
  const year = new Date().getUTCFullYear();
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await qRun(
    db.insert(schema.tenants).values({
      id,
      slug,
      domain: null,
      timezone: normalizeTimeZone(options.timezone),
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
    }),
  );

  return { tenant, row: (await getTenantRow(id))! };
}

export async function updateTenantConnect(
  tenantId: string,
  options: { accountId?: string; status: ConnectStatus },
) {
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({
        stripeConnectAccountId: options.accountId,
        stripeConnectStatus: options.status,
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, tenantId)),
  );
}

export async function setTenantDomain(
  tenantId: string,
  domain: string | null,
  options?: {
    domainCfId?: string | null;
    domainStatus?: string | null;
  },
) {
  const db = getDb();
  const patch: {
    domain: string | null;
    updatedAt: string;
    domainCfId?: string | null;
    domainStatus?: string | null;
  } = {
    domain,
    updatedAt: nowIso(),
  };
  if (options && "domainCfId" in options) {
    patch.domainCfId = options.domainCfId;
  } else if (domain === null) {
    patch.domainCfId = null;
  }
  if (options && "domainStatus" in options) {
    patch.domainStatus = options.domainStatus;
  } else if (domain === null) {
    patch.domainStatus = "cleared";
  }
  await qRun(
    db
      .update(schema.tenants)
      .set(patch)
      .where(eq(schema.tenants.id, tenantId)),
  );
}

export async function updateTenantDomainMeta(
  tenantId: string,
  options: {
    domainCfId?: string | null;
    domainStatus?: string | null;
  },
) {
  const db = getDb();
  const patch: {
    updatedAt: string;
    domainCfId?: string | null;
    domainStatus?: string | null;
  } = { updatedAt: nowIso() };
  if (options.domainCfId !== undefined) patch.domainCfId = options.domainCfId;
  if (options.domainStatus !== undefined) {
    patch.domainStatus = options.domainStatus;
  }
  await qRun(
    db
      .update(schema.tenants)
      .set(patch)
      .where(eq(schema.tenants.id, tenantId)),
  );
}

export async function addTenantStorageUsage(tenantId: string, bytes: number) {
  const db = getDb();
  const row = await getTenantRow(tenantId);
  if (!row) return;
  await qRun(
    db
      .update(schema.tenants)
      .set({
        storageBytesUsed: Math.max(0, row.storageBytesUsed + bytes),
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, tenantId)),
  );
}

export function platformFeeAmountCents(amountCents: number) {
  const bps = Number(process.env.PLATFORM_FEE_BPS ?? "0");
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.floor((amountCents * bps) / 10_000);
}

export async function updateTenantConfig(tenantId: string, patch: Partial<Tenant>) {
  const row = await getTenantRow(tenantId);
  if (!row) return null;
  const config = {
    ...parseTenantConfig(row),
    ...patch,
    id: row.id,
    slug: row.slug,
    domain: row.domain,
  };
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({ configJson: JSON.stringify(config), updatedAt: nowIso() })
      .where(eq(schema.tenants.id, tenantId)),
  );
  return getTenantRow(tenantId);
}

export async function updateTenantTimezone(tenantId: string, timezone: string) {
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({ timezone: normalizeTimeZone(timezone), updatedAt: nowIso() })
      .where(eq(schema.tenants.id, tenantId)),
  );
  return getTenantRow(tenantId);
}
