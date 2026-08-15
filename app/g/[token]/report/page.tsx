import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  if (!gallery || gallery.revokedAt) notFound();
  const row = await getTenantRow(gallery.tenantId);
  if (!row || !entitlements(row.plan).reports) notFound();

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
