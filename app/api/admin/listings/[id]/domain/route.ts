import { NextResponse } from "next/server";
import { z } from "zod";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import {
  refreshListingDomain,
  removeListingDomain,
  upsertListingDomain,
} from "@/lib/listing-domains";

export const runtime = "nodejs";

const bodySchema = z.object({
  hostname: z.string().trim().max(253).optional(),
  action: z.enum(["save", "clear", "refresh"]).default("save"),
});

async function tenantFor() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const auth = await requireTenantMembership(session.activeTenantId);
  return auth.ok ? session.activeTenantId : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantFor();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  return NextResponse.json(await refreshListingDomain(tenantId, id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantFor();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Check the hostname." }, { status: 400 });
  }
  if (parsed.data.action === "clear") {
    return NextResponse.json(await removeListingDomain(tenantId, id));
  }
  if (parsed.data.action === "refresh") {
    return NextResponse.json(await refreshListingDomain(tenantId, id));
  }
  if (!parsed.data.hostname) {
    return NextResponse.json({ ok: false, error: "Enter a hostname." }, { status: 400 });
  }
  const result = await upsertListingDomain({
    tenantId,
    listingPageId: id,
    hostname: parsed.data.hostname,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
