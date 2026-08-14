export class TenantIsolationError extends Error {
  constructor(message = "Tenant isolation violation.") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

export function assertSameTenant(
  rowTenantId: string | null | undefined,
  tenantId: string,
  label = "Resource",
) {
  if (!rowTenantId || rowTenantId !== tenantId) {
    throw new TenantIsolationError(`${label} does not belong to this studio.`);
  }
}

export function belongsToTenant(
  rowTenantId: string | null | undefined,
  tenantId: string,
) {
  return Boolean(rowTenantId && rowTenantId === tenantId);
}
