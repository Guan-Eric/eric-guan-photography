import type { Metadata } from "next";
import { StudioPricingEditor } from "@/components/studio-pricing-editor";
import { getPhotographerSession } from "@/lib/auth";
import { publicStudioUrl } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const tenant = await getTenant(session.activeTenantId);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });
  return <StudioPricingEditor tenant={tenant} viewUrl={`${siteUrl}/pricing`} />;
}
