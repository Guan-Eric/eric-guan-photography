import type { Metadata } from "next";
import { GalleryLinkExpired } from "@/components/gallery-link-expired";
import { StatusPage } from "@/components/status-page";
import { entitlements } from "@/lib/billing";
import { getGalleryByToken } from "@/lib/galleries";
import { galleryReport } from "@/lib/gallery-analytics";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Listing report",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GalleryReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gallery = await getGalleryByToken(token);
  if (!gallery) {
    return (
      <StatusPage
        shell="delivery"
        eyebrow="Not found"
        title="This report isn’t available"
        body="The gallery link may be mistyped, or the gallery was removed."
        actions={[{ href: "/admin", label: "Back to studio", variant: "outline" }]}
      />
    );
  }
  if (gallery.revokedAt) {
    return <GalleryLinkExpired />;
  }
  const row = await getTenantRow(gallery.tenantId);
  if (!row || !entitlements(row.plan).reports) {
    return (
      <StatusPage
        shell="delivery"
        eyebrow="Plan"
        title="Reports aren’t on your plan"
        body="Upgrade to a plan that includes gallery activity reports, then reopen this link."
        actions={[
          { href: "/admin/settings", label: "Open settings", variant: "solid" },
        ]}
      />
    );
  }

  const tenant = await getTenant(gallery.tenantId);
  const stats = await galleryReport(gallery.id, gallery.tenantId);

  return (
    <main className="admin-shell" id="main">
      <p className="eyebrow">{tenant.studioName}</p>
      <h1>Media report</h1>
      <p className="lede">{gallery.propertyAddress}</p>
      <ul className="hero-proof">
        <li>{stats.views} views</li>
        <li>{stats.downloads} downloads</li>
      </ul>
      <p className="muted">Forward this page to your seller as proof of activity.</p>
    </main>
  );
}
