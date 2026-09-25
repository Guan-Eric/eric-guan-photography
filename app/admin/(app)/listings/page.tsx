import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingsIndex } from "@/components/listings-index";
import { getPhotographerSession } from "@/lib/auth";
import { entitlements } from "@/lib/billing";
import { listingPublicState } from "@/lib/listing-compliance";
import {
  backfillListingPages,
  listListingPages,
  listingPageMedia,
} from "@/lib/listing-pages";
import { publicStudioUrl } from "@/lib/platform";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};

export default async function AdminListingsPage() {
  const session = await getPhotographerSession();
  if (!session) redirect("/login");
  if (!session.activeTenantId) redirect("/onboarding");

  const tenant = await getTenant(session.activeTenantId);
  const row = await getTenantRow(session.activeTenantId);
  const access = row ? entitlements(row.plan) : null;
  await backfillListingPages(session.activeTenantId);
  const pages = await listListingPages(session.activeTenantId);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });

  const rows = await Promise.all(
    pages.map(async (page) => {
      const media = await listingPageMedia(page);
      const { state, checklistErrors } = listingPublicState(page, media);
      return { page, state, checklistErrors };
    }),
  );

  return (
    <div className="studio-settings">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Listings</p>
          <h1>Property websites</h1>
          <p className="muted">
            Every published delivery gets a property page. You pick the look,
            photos, and enquiry form; the agent writes the copy and open houses
            from their portal.
          </p>
        </div>
      </div>

      {access && !access.propertyPages ? (
        <p className="field-hint">
          Property pages are included on Trial, Growth, Studio and pay-as-you-go.
          Publishing a delivery on Starter skips this step.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="studio-empty">
          <h2>No property pages yet</h2>
          <p>
            {access && !access.propertyPages
              ? "Upgrade to Growth, Studio, or pay-as-you-go to create a page when you publish a gallery."
              : "Publish a gallery from Shoots and the page appears here."}
          </p>
          <Link className="btn btn-solid" href="/admin">
            Go to orders
          </Link>
        </div>
      ) : (
        <ListingsIndex rows={rows} siteUrl={siteUrl} />
      )}
    </div>
  );
}
