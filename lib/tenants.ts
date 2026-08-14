import { ericGuan } from "@/content/tenants/eric-guan";
import type { Tenant } from "@/lib/tenant-schema";

const tenants: Tenant[] = [ericGuan];

/**
 * The tenant served when no host-based match applies. Once custom domains and
 * subdomain routing land, resolution moves to middleware and this becomes the
 * fallback for local development only.
 */
export const DEFAULT_TENANT_ID = ericGuan.id;

export function getTenant(id: string = DEFAULT_TENANT_ID): Tenant {
  const tenant = tenants.find((candidate) => candidate.id === id);
  if (!tenant) {
    throw new Error(`Unknown tenant: ${id}`);
  }
  return tenant;
}

export function getTenantByHost(host: string | null): Tenant {
  if (!host) return getTenant();

  const hostname = host.split(":")[0].toLowerCase();
  const byDomain = tenants.find((candidate) => candidate.domain === hostname);
  if (byDomain) return byDomain;

  const [subdomain] = hostname.split(".");
  const bySlug = tenants.find((candidate) => candidate.slug === subdomain);
  if (bySlug) return bySlug;

  return getTenant();
}

export function listTenants(): Tenant[] {
  return tenants;
}

/** CSS custom property declarations for a tenant, applied at the html element. */
export function themeStyle(tenant: Tenant): React.CSSProperties {
  const { theme } = tenant;
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
