import type { Tenant } from "@/lib/tenant-schema";

/** Far-future preferred slot so lead-time / calendar checks pass. */
export function futurePreferredSlot(durationMinutes = 60) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 10);
  start.setUTCHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: "Test preferred slot",
  };
}

export function bookingFixture(tenant: Tenant, overrides: Record<string, unknown> = {}) {
  const duration =
    tenant.packages.find((pkg) => pkg.id === "standard")?.durationMinutes ?? 60;
  return {
    packageId: "standard",
    squareFootage: 1500,
    propertyAddress: "123 Test Street Montreal",
    postalCode: "H2X 1Y4",
    city: "Montreal",
    preferredSlots: [futurePreferredSlot(duration)],
    agentName: "Test Agent",
    agentEmail: `agent-${Date.now()}@example.com`,
    occupancy: "vacant" as const,
    accessType: "lockbox" as const,
    ...overrides,
  };
}
