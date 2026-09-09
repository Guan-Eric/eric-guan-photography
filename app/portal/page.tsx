import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalSignOut } from "@/components/portal-sign-out";
import { getAgentSession } from "@/lib/agent-auth";
import { galleryPublicUrl, getGalleryByOrderId } from "@/lib/galleries";
import { getListingPageByOrder } from "@/lib/listing-pages";
import { listMediaLinksForOrder } from "@/lib/media-links";
import { listOrdersByAgentEmail } from "@/lib/orders";
import { publicStudioUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const metadata: Metadata = {
  title: "My listings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgentPortalPage() {
  const tenant = await getRequestTenant();
  if (!tenant) redirect("/portal/login");
  const session = await getAgentSession();
  if (!session || session.tenantId !== tenant.id) redirect("/portal/login");

  const row = await getTenantRow(tenant.id);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: row?.domain,
    siteUrl: tenant.siteUrl,
    domainStatus: row?.domainStatus,
  });
  const orders = await listOrdersByAgentEmail(tenant.id, session.email);

  const cards = await Promise.all(
    orders.map(async (order) => {
      const gallery = await getGalleryByOrderId(order.id, tenant.id);
      const listing = await getListingPageByOrder(order.id, tenant.id);
      const links = await listMediaLinksForOrder(order.id, tenant.id);
      const extras = [
        links.some((link) => link.kind === "video") ? "video" : null,
        links.some((link) => link.kind === "tour") ? "tour" : null,
        links.some((link) => link.kind === "floorplan" || link.kind === "doc")
          ? "floor plan"
          : null,
      ].filter(Boolean);
      return {
        order,
        galleryUrl: gallery
          ? galleryPublicUrl(gallery.publicToken, "branded", siteUrl)
          : null,
        listingUrl: listing ? `${siteUrl.replace(/\/$/, "")}/p/${listing.slug}` : null,
        listingId: listing?.id ?? null,
        extrasHint: extras.length ? `Includes ${extras.join(" + ")}` : null,
      };
    }),
  );

  return (
    <main className="page-section" id="main">
      <div className="page-inner studio-settings">
        <div className="admin-toolbar">
          <div>
            <p className="eyebrow">{tenant.studioName}</p>
            <h1>Your listings</h1>
            <p className="muted">{session.email}</p>
          </div>
          <PortalSignOut />
        </div>

        {cards.length === 0 ? (
          <p>No listings yet. Book a shoot to see it here.</p>
        ) : (
          <ul className="listing-index">
            {cards.map(({ order, galleryUrl, listingUrl, listingId, extrasHint }) => (
              <li key={order.id}>
                <div>
                  <strong>{order.propertyAddress}</strong>
                  <span className="muted">
                    {order.packageName} · {order.status}
                  </span>
                </div>
                <div className="listing-index-actions">
                  {galleryUrl ? (
                    <>
                      <a className="text-link" href={galleryUrl}>
                        Gallery
                      </a>
                      {extrasHint ? (
                        <span className="muted">{extrasHint}</span>
                      ) : null}
                    </>
                  ) : null}
                  {listingUrl ? (
                    <a className="text-link" href={listingUrl}>
                      Listing page
                    </a>
                  ) : null}
                  {listingId ? (
                    <Link className="btn btn-solid" href={`/portal/listings/${listingId}`}>
                      Edit listing
                    </Link>
                  ) : null}
                  <Link className="btn btn-outline" href={`/book?package=${order.packageId}`}>
                    Book again
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
