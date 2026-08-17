import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ericGuan } from "@/content/tenants/eric-guan";
import {
  PLATFORM_HOST_HEADER,
  TENANT_HOST_HEADER,
  hostnameFromHost,
  isPlatformHostname,
  platformTheme,
} from "@/lib/platform";
import {
  getTenantRow,
  getTenantRowByDomain,
  getTenantRowBySlug,
  listTenantRows,
  tenantFromRow,
} from "@/lib/tenant-store";
import { getListingDomainByHostname } from "@/lib/domain-billing";
import type { Tenant, ThemeTokens } from "@/lib/tenant-schema";

export const DEFAULT_TENANT_ID = ericGuan.id;
export const TENANT_HEADER = "x-tenant-id";
export const TENANT_SLUG_HEADER = "x-tenant-slug";

export async function getTenant(id: string = DEFAULT_TENANT_ID): Promise<Tenant> {
  const row = await getTenantRow(id);
  if (row) return tenantFromRow(row);
  if (id === ericGuan.id) return ericGuan;
  throw new Error(`Unknown tenant: ${id}`);
}

/**
 * Resolve tenant from Host. Apex / localhost is the platform (null).
 * Subdomain match: `{slug}.{PLATFORM_ROOT_DOMAIN}` e.g. demo.localhost
 */
export async function getTenantByHost(host: string | null): Promise<Tenant | null> {
  if (!host) return null;

  const hostname = hostnameFromHost(host);
  if (isPlatformHostname(hostname)) return null;

  const byDomain = await getTenantRowByDomain(hostname);
  if (byDomain) return tenantFromRow(byDomain);

  const listing = await getListingDomainByHostname(hostname);
  if (listing) {
    const row = await getTenantRow(listing.tenantId);
    if (row) return tenantFromRow(row);
  }

  const root = (process.env.PLATFORM_ROOT_DOMAIN ?? "localhost").toLowerCase();
  if (hostname.endsWith(`.${root}`)) {
    const slug = hostname.slice(0, -(root.length + 1)).split(".")[0];
    const bySlug = await getTenantRowBySlug(slug);
    if (bySlug) return tenantFromRow(bySlug);
  }

  return null;
}

export async function listTenants(): Promise<Tenant[]> {
  const rows = await listTenantRows();
  if (rows.length === 0) return [ericGuan];
  return rows.map(tenantFromRow);
}

export async function getRequestTenant(): Promise<Tenant | null> {
  const headerStore = await headers();
  const host =
    headerStore.get(TENANT_HOST_HEADER) ??
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host");

  // Apex / localhost is always the SaaS — never a studio, even if a tenant
  // hint header or custom-domain row is present.
  if (
    headerStore.get(PLATFORM_HOST_HEADER) === "1" ||
    isPlatformHostname(hostnameFromHost(host))
  ) {
    return null;
  }

  const fromHeader = headerStore.get(TENANT_HEADER);
  if (fromHeader) {
    try {
      return await getTenant(fromHeader);
    } catch {
      // fall through
    }
  }
  const slugHint = headerStore.get(TENANT_SLUG_HEADER);
  if (slugHint) {
    const bySlug = await getTenantRowBySlug(slugHint);
    if (bySlug) return tenantFromRow(bySlug);
  }
  return getTenantByHost(host);
}

export async function requireRequestTenant(): Promise<Tenant> {
  const tenant = await getRequestTenant();
  if (!tenant) notFound();
  return tenant;
}

export async function resolveHostTarget(host: string | null) {
  if (!host) return { kind: "unknown" as const };
  const hostname = hostnameFromHost(host);
  if (isPlatformHostname(hostname)) return { kind: "platform" as const };

  const listing = await getListingDomainByHostname(hostname);
  if (listing) {
    const row = await getTenantRow(listing.tenantId);
    if (row) {
      return {
        kind: "listing" as const,
        tenant: tenantFromRow(row),
        listingPageId: listing.listingPageId,
        hostname: listing.hostname,
        status: listing.status,
      };
    }
  }

  const tenant = await getTenantByHost(host);
  if (tenant) return { kind: "studio" as const, tenant };
  return { kind: "unknown" as const };
}

export async function isPlatformRequest() {
  const headerStore = await headers();
  if (headerStore.get(PLATFORM_HOST_HEADER) === "1") return true;
  const host =
    headerStore.get(TENANT_HOST_HEADER) ??
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host");
  return isPlatformHostname(hostnameFromHost(host));
}

/** CSS custom property declarations for a tenant, applied at the html element. */
export function themeStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    "--bg": theme.bg,
    "--bg-deep": theme.bgDeep,
    "--ink": theme.ink,
    "--ink-soft": theme.inkSoft,
    "--line": theme.line,
    "--accent": theme.accent,
    "--accent-soft": theme.accentSoft,
    "--paper": theme.paper,
    "--radius": theme.radius,
    "--font-display": theme.fontDisplay,
    "--font-body": theme.fontBody,
  } as React.CSSProperties;
}

export function requestTheme(tenant: Tenant | null): ThemeTokens {
  return tenant?.theme ?? platformTheme();
}
