import type { Tenant } from "@/lib/tenant-schema";

const MONTREAL_PREFIXES = ["H", "J3", "J4", "J5", "J7"] as const;

export function normalizePostalCode(raw: string) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function formatPostalCode(raw: string) {
  const normalized = normalizePostalCode(raw);
  if (normalized.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
  }
  if (normalized.length === 5 && /^\d{5}$/.test(normalized)) {
    return normalized;
  }
  if (normalized.length === 9 && /^\d{9}$/.test(normalized)) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  }
  return normalized;
}

export function isValidCanadianPostalCode(raw: string) {
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalizePostalCode(raw));
}

export function isValidUsZip(raw: string) {
  const normalized = normalizePostalCode(raw).replace("-", "");
  return /^\d{5}(\d{4})?$/.test(normalized);
}

function gateFor(tenant?: Tenant | null) {
  return (
    tenant?.serviceAreaGate ?? {
      enabled: true,
      region: "CA" as const,
      prefixes: [...MONTREAL_PREFIXES],
      message:
        "I currently cover Greater Montréal (island, Laval, South Shore, and nearby North Shore). If this listing is farther out, email me and I’ll say whether the drive works.",
    }
  );
}

export function isValidPostalForTenant(raw: string, tenant?: Tenant | null) {
  const gate = gateFor(tenant);
  if (!gate.enabled || gate.region === "none") {
    return normalizePostalCode(raw).length >= 3;
  }
  if (gate.region === "US") return isValidUsZip(raw);
  return isValidCanadianPostalCode(raw);
}

export function isInServiceArea(raw: string, tenant?: Tenant | null) {
  const gate = gateFor(tenant);
  const normalized = normalizePostalCode(raw);
  if (!gate.enabled || gate.region === "none") {
    return normalized.length >= 3;
  }
  if (!isValidPostalForTenant(raw, tenant)) return false;
  if (gate.prefixes.length === 0) return true;
  return gate.prefixes.some((prefix) => normalized.startsWith(prefix.toUpperCase()));
}

export function serviceAreaMessage(tenant?: Tenant | null) {
  return gateFor(tenant).message;
}
