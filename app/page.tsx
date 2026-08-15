import Image from "next/image";
import Link from "next/link";
import { Gallery } from "@/components/gallery";
import { LocalBusinessJsonLd } from "@/components/json-ld";
import { RevealObserver } from "@/components/reveal-observer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tenant = await requireRequestTenant();
  const primaryArea = tenant.serviceAreas[0];

  return (
    <>
      <LocalBusinessJsonLd tenant={tenant} />
      <RevealObserver />
      <SiteHeader tenant={tenant} />

      <main id="main">
        <section className="hero" aria-label="Introduction">
          <div className="hero-media">
            <Image
              src={tenant.hero.src}
              alt={tenant.hero.alt}
              width={tenant.hero.width}
              height={tenant.hero.height}
              sizes="100vw"
              priority
              fetchPriority="high"
              unoptimized={tenant.hero.src.startsWith("/api/")}
            />
          </div>
          <div className="hero-veil" aria-hidden="true" />
          <div className="hero-copy">
            <p className="brand">{tenant.photographerName}</p>
            <h1>{tenant.tagline}</h1>
            <p className="lede">{tenant.lede}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/book">
                Request a shoot
              </Link>
              <Link className="btn btn-ghost" href="#work">
                View work
              </Link>
            </div>
            <ul className="hero-proof">
              <li>{tenant.turnaround} delivery</li>
              <li>MLS-ready sizes included</li>
              {primaryArea?.city && primaryArea.city !== "Your market" ? (
                <li>{primaryArea.city} and surrounding areas</li>
              ) : null}
            </ul>
          </div>
        </section>

        <section className="work" id="work">
          <div className="section-intro">
            <p className="eyebrow">Selected work</p>
            <h2>Spaces shown with clarity and calm.</h2>
          </div>

          {tenant.gallery.length > 0 ? (
            <Gallery images={tenant.gallery} />
          ) : (
            <p className="portfolio-note">Portfolio photos will appear here once uploaded.</p>
          )}

          {!tenant.portfolioComplete && tenant.gallery.length > 0 ? (
            <p className="portfolio-note">
              Placeholder images for layout — swap these for your listing photos
              when ready.
            </p>
          ) : null}
        </section>

        <section className="services" id="services">
          <div className="services-inner">
            <div className="section-intro">
              <p className="eyebrow">For agents</p>
              <h2>Simple packages. Fast turnaround.</h2>
              <p className="section-copy">
                Built for busy agents who need MLS-ready photos without the
                hassle.
              </p>
            </div>

            <ul className="price-list">
              {tenant.packages.map((pkg) => (
                <li key={pkg.id}>
                  <div>
                    <h3>{pkg.name}</h3>
                    <p>{pkg.summary}</p>
                  </div>
                  <p className="price">{pkg.price}</p>
                </li>
              ))}
            </ul>

            <p className="section-copy">
              <Link className="btn btn-outline" href="/pricing">
                See what&rsquo;s included
              </Link>
            </p>
          </div>
        </section>

        <section className="process" id="process">
          <div className="process-inner">
            <div className="section-intro">
              <p className="eyebrow">Process</p>
              <h2>Three steps from vacant home to live listing.</h2>
            </div>
            <ol className="steps">
              {tenant.process.map((step, index) => (
                <li key={step.title} data-reveal>
                  <span className="step-num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="contact" id="contact">
          <div className="contact-inner">
            <div className="section-intro">
              <p className="eyebrow">Book</p>
              <h2>Have a listing that needs photos?</h2>
              <p className="section-copy">
                Get an instant quote from square footage, pick an open slot, and
                send access notes in one request.
              </p>
            </div>

            <div className="contact-panel">
              <p className="contact-hint" style={{ marginTop: 0 }}>
                Prefer email?{" "}
                <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
                . Either way, send the{" "}
                <Link href="/prep">pre-shoot checklist</Link> to your seller
                ahead of time.
              </p>
              <Link className="btn btn-solid" href="/book">
                Book a listing shoot
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
