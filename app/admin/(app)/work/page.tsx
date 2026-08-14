import type { Metadata } from "next";
import { StudioWorkEditor } from "@/components/studio-work-editor";
import { getPhotographerSession } from "@/lib/auth";
import { studioOrigin } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Work",
  robots: { index: false, follow: false },
};

export default async function AdminWorkPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const tenant = getTenant(session.activeTenantId);
  const siteUrl = studioOrigin({ slug: tenant.slug, domain: tenant.domain });
  return <StudioWorkEditor tenant={tenant} viewUrl={`${siteUrl}/#work`} />;
}
