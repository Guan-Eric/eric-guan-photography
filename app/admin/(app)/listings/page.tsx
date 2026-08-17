import type { Metadata } from "next";
import Link from "next/link";
import { getPhotographerSession } from "@/lib/auth";
import { entitlements } from "@/lib/billing";
import { listListingPages } from "@/lib/listing-pages";
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
  if (!session?.activeTenantId) return null;

  const tenant = await getTenant(session.activeTenantId);
  const row = await getTenantRow(session.activeTenantId);
  const access = row ? entitlements(row.plan) : null;
  const pages = await listListingPages(session.activeTenantId);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });

  return (
    <div className="studio-settings">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Listings</p>
          <h1>Property websites</h1>
          <p className="muted">
            Every published delivery gets a property page. Edit the copy, pick a
            look, and share the link.
          </p>
        </div>
      </div>

      {access && !access.propertyPages ? (
        <p className="field-hint">
          Property pages are included on Growth, Studio and pay-as-you-go.
          Publishing a delivery on Starter skips this step.
        </p>
      ) : null}

      {pages.length === 0 ? (
        <div className="studio-empty">
          <h2>No property pages yet</h2>
          <p>Publish a gallery from the Orders board and the page appears here.</p>
          <Link className="btn btn-solid" href="/admin">
            Go to orders
          </Link>
        </div>
      ) : (
        <ul className="listing-index">
          {pages.map((page) => (
            <li key={page.id}>
              <div>
                <strong>{page.title}</strong>
                <span className="muted">
                  {page.propertyAddress} · {page.publishedAt ? "Published" : "Draft"} ·{" "}
                  {page.theme}
                </span>
              </div>
              <div className="listing-index-actions">
                <Link className="btn btn-outline" href={`/admin/listings/${page.id}`}>
                  Edit
                </Link>
                <a
                  className="text-link"
                  href={`${siteUrl.replace(/\/$/, "")}/p/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
