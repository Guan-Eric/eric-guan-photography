import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { LocalBusinessJsonLd } from "@/components/json-ld";
import { RevealObserver } from "@/components/reveal-observer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireRequestTenant } from "@/lib/tenants";

type Params = { city: string };

function findArea<T extends { slug: string }>(slug: string, areas: T[]) {
  return areas.find((area) => area.slug === slug);
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const tenant = await requireRequestTenant();
  const { city } = await params;
  const area = findArea(city, tenant.serviceAreas);
  if (!area) return {};

  const title = `Real Estate Photography in ${area.city}`;

  return {
    title,
    description: `Real estate photography for agents in ${area.city}. MLS-ready galleries delivered in ${tenant.turnaround}, with packages from ${tenant.packages[0]?.price ?? ""}.`,
    alternates: { canonical: `/real-estate-photography/${area.slug}` },
    openGraph: { title: `${title} — ${tenant.studioName}` },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const tenant = await requireRequestTenant();
  const { city } = await params;
  const area = findArea(city, tenant.serviceAreas);
  if (!area) notFound();

  return (
    <>
      <LocalBusinessJsonLd tenant={tenant} />
      <RevealObserver />
      <SiteHeader tenant={tenant} solid />

      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">{area.city}</p>
            <h1>Real estate photography in {area.city}.</h1>
            <p className="section-copy">
              {tenant.lede} Serving {area.city} and the surrounding area, with
              galleries delivered in {tenant.turnaround}.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-solid" href="/book">
                Request a shoot
              </Link>
              <Link className="btn btn-outline" href="/pricing">
                See pricing
              </Link>
            </div>
          </div>
        </header>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div className="prose">
              <h2>Built around how agents actually work</h2>
              <p>
                Listings move quickly, so the job is not just good photos — it is
                good photos in your hands before the listing goes live. Every
                shoot in {area.city} comes back within {tenant.turnaround}, sized
                for MLS upload and for print, so nothing needs resizing before you
                publish.
              </p>
              <h2>Areas covered</h2>
              <p>
                Regular shoots across {area.city} and nearby, including:
              </p>
              <ul className="pill-list">
                {area.neighbourhoods.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="work" id="work">
          <div className="section-intro">
            <p className="eyebrow">Recent work</p>
            <h2>Interiors, exteriors, and the details buyers linger on.</h2>
          </div>
          {tenant.gallery.length > 0 ? <Gallery images={tenant.gallery} /> : null}
        </section>
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
