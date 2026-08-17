import dns from "node:dns/promises";
import { platformRootDomain } from "@/lib/platform";

export type DomainVerification = {
  domain: string;
  verified: boolean;
  status: "verified" | "pending" | "cleared" | "error";
  expectedTarget: string;
  records: string[];
  message: string;
};

/**
 * Expected DNS target for custom studio domains.
 * Prefer CNAME → CUSTOM_DOMAIN_TARGET (sites.<root>), else sites.<PLATFORM_ROOT_DOMAIN>.
 */
export function expectedDomainTarget() {
  const custom = process.env.CUSTOM_DOMAIN_TARGET?.trim().toLowerCase();
  if (custom) return custom;
  const root = (
    process.env.PLATFORM_ROOT_DOMAIN ?? "localhost"
  ).toLowerCase();
  if (!root || root === "localhost") return "localhost";
  return `sites.${root}`;
}

export function normalizeCustomDomain(input: string) {
  return normalizeDomain(input);
}

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function recordMatches(value: string, expected: string) {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  const target = expected.trim().toLowerCase().replace(/\.$/, "");
  return (
    normalized === target ||
    normalized === `www.${target}` ||
    normalized.endsWith(`.${target}`)
  );
}

/**
 * Verify a custom hostname points at the platform via CNAME or A.
 * Localhost / empty domain skips live DNS (dev-friendly).
 */
export async function verifyCustomDomain(
  domainInput: string | null,
): Promise<DomainVerification> {
  if (!domainInput) {
    return {
      domain: "",
      verified: true,
      status: "cleared",
      expectedTarget: expectedDomainTarget(),
      records: [],
      message: "Custom domain cleared.",
    };
  }

  const domain = normalizeDomain(domainInput);
  const expectedTarget = expectedDomainTarget();
  const root = platformRootDomain();

  if (
    domain === "localhost" ||
    domain.endsWith(".localhost") ||
    expectedTarget === "localhost" ||
    root === "localhost"
  ) {
    return {
      domain,
      verified: true,
      status: "verified",
      expectedTarget,
      records: [],
      message: `Domain saved (DNS check skipped on localhost). In production, CNAME ${domain} → ${expectedTarget}.`,
    };
  }

  const records: string[] = [];

  try {
    try {
      const cnames = await dns.resolveCname(domain);
      records.push(...cnames.map((item) => `CNAME ${item}`));
      if (cnames.some((item) => recordMatches(item, expectedTarget))) {
        return {
          domain,
          verified: true,
          status: "verified",
          expectedTarget,
          records,
          message: `DNS verified: CNAME points to ${expectedTarget}.`,
        };
      }
    } catch {
      // No CNAME — try A records next.
    }

    try {
      const addresses = await dns.resolve4(domain);
      records.push(...addresses.map((item) => `A ${item}`));

      let expectedIps: string[] = [];
      try {
        expectedIps = await dns.resolve4(expectedTarget);
      } catch {
        expectedIps = [];
      }

      if (
        expectedIps.length > 0 &&
        addresses.some((ip) => expectedIps.includes(ip))
      ) {
        return {
          domain,
          verified: true,
          status: "verified",
          expectedTarget,
          records,
          message: `DNS verified: A record matches ${expectedTarget}.`,
        };
      }
    } catch {
      // No A records either.
    }

    return {
      domain,
      verified: false,
      status: "pending",
      expectedTarget,
      records,
      message: records.length
        ? `Domain saved but DNS does not yet point to ${expectedTarget}. Found: ${records.join(", ")}. Add a CNAME to ${expectedTarget}, then re-save.`
        : `Domain saved. Add a CNAME from ${domain} → ${expectedTarget}, wait for propagation, then re-save to verify.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "DNS lookup failed";
    return {
      domain,
      verified: false,
      status: "error",
      expectedTarget,
      records,
      message: `Domain saved but DNS check failed (${detail}). Point ${domain} (CNAME) to ${expectedTarget}.`,
    };
  }
}
