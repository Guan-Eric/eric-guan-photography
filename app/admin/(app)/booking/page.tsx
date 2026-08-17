import type { Metadata } from "next";
import { StudioBookingEditor } from "@/components/studio-booking-editor";
import { getPhotographerSession } from "@/lib/auth";
import { publicStudioUrl } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

export default async function AdminBookingPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const tenant = await getTenant(session.activeTenantId);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });
  return <StudioBookingEditor tenant={tenant} viewUrl={`${siteUrl}/book`} />;
}
