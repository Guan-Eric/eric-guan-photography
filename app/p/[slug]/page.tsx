import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingPageForPublic } from "@/lib/listing-pages";
import { requireRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { slug: string };
type Search = { brand?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const tenant = await requireRequestTenant();
  const { slug } = await params;
  const data = listingPageForPublic(tenant.id, slug);
  if (!data) return { title: "Listing", robots: { index: false, follow: false } };
  return {
    title: data.page.title,
    description: `Photos of ${data.page.propertyAddress}`,
    robots: { index: false, follow: false },
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const tenant = await requireRequestTenant();
  const { slug } = await params;
  const query = await searchParams;
  const data = listingPageForPublic(tenant.id, slug);
  if (!data) notFound();

  const branded = query.brand !== "off" && data.page.brandMode !== "unbranded";
  const { page, media } = data;
  const mapSrc =
    page.mapLat && page.mapLng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(page.mapLng) - 0.01}%2C${Number(page.mapLat) - 0.01}%2C${Number(page.mapLng) + 0.01}%2C${Number(page.mapLat) + 0.01}&layer=mapnik&marker=${page.mapLat}%2C${page.mapLng}`
      : null;

  return (
    <main className="listing-page" id="main">
      <header className="listing-hero">
        {branded ? <p className="eyebrow">{tenant.studioName}</p> : null}
        <h1>{page.title}</h1>
        <p className="lede">{page.propertyAddress}</p>
      </header>

      {media.length > 0 ? (
        <div className="delivery-grid listing-grid">
          {media.map((asset) => (
            <figure key={asset.id} className="delivery-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/p/${slug}/media/${asset.id}`}
                alt={asset.roomLabel ?? asset.originalName}
                width={asset.width}
                height={asset.height}
              />
              <figcaption>{asset.roomLabel ?? asset.originalName}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <section className="listing-agent">
        <p className="eyebrow">Presented by</p>
        <h2>{page.agentName}</h2>
        {page.brokerage ? <p>{page.brokerage}</p> : null}
        <p>
          <a href={`mailto:${page.agentEmail}`}>{page.agentEmail}</a>
        </p>
      </section>

      {mapSrc ? (
        <section className="listing-map">
          <iframe title="Map" src={mapSrc} loading="lazy" />
        </section>
      ) : (
        <p className="muted" style={{ padding: "0 6vw 2rem" }}>
          <a
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(page.propertyAddress)}`}
            target="_blank"
            rel="noreferrer"
          >
            View on OpenStreetMap
          </a>
        </p>
      )}

      {branded ? (
        <footer className="delivery-footer">
          <p>Photos by {tenant.photographerName}.</p>
        </footer>
      ) : null}
    </main>
  );
}
