import { requireTenantMembership } from "@/lib/auth";
import { hasActiveAccess } from "@/lib/billing";
import { getTenantRow } from "@/lib/tenant-store";

export async function requireStudioOwner(tenantId: string) {
  const auth = await requireTenantMembership(tenantId);
  if (!auth.ok) return auth;
  if (auth.membership.role !== "owner") {
    return { ok: false as const, error: "Only the studio owner can do that." };
  }
  return auth;
}

export async function requireActiveStudio(tenantId: string) {
  const auth = await requireTenantMembership(tenantId);
  if (!auth.ok) return auth;
  const row = await getTenantRow(tenantId);
  if (!row) {
    return { ok: false as const, error: "Studio not found." };
  }
  if (!hasActiveAccess(row)) {
    return {
      ok: false as const,
      error: "Your trial or subscription is inactive. Update billing in Settings to continue.",
    };
  }
  return { ok: true as const, session: auth.session, membership: auth.membership, row };
}
