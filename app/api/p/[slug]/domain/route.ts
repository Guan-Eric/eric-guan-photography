import { NextResponse } from "next/server";
import { CUSTOM_DOMAINS_DISABLED_NOTE, customDomainsEnabled } from "@/lib/custom-domain";
import { createListingDomainCheckout } from "@/lib/listing-domains";
import { listingPageForPublic } from "@/lib/listing-pages";
import { publicStudioUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!customDomainsEnabled()) {
    return NextResponse.json(
      { ok: false, error: CUSTOM_DOMAINS_DISABLED_NOTE },
      { status: 503 },
    );
  }

  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const { slug } = await context.params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const row = await getTenantRow(tenant.id);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: row?.domain,
    siteUrl: tenant.siteUrl,
    domainStatus: row?.domainStatus,
  });
  const listingUrl = `${siteUrl.replace(/\/$/, "")}/p/${slug}`;
  const result = await createListingDomainCheckout({
    tenantId: tenant.id,
    listingPage: data.page,
    successUrl: `${listingUrl}?domain=paid`,
    cancelUrl: listingUrl,
    buyerEmail: data.page.agentEmail,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
