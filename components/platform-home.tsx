import Image from "next/image";
import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { RevealObserver } from "@/components/reveal-observer";
import { PLAN_DEFS } from "@/lib/plan-defs";
import { platformName } from "@/lib/platform";

const HERO = {
  src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=80",
  alt: "Bright modern home ready for listing photographs",
  width: 2400,
  height: 1600,
};

const DELIVERY = {
  src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80",
  alt: "Sunlit living room photographed for a listing gallery",
  width: 2000,
  height: 1333,
};

export function PlatformHome() {
  const name = platformName();

  return (
    <>
      <RevealObserver />
      <PlatformHeader />

      <main id="main">
        <section className="hero" aria-label="Introduction">
          <div className="hero-media">
            <Image
              src={HERO.src}
              alt={HERO.alt}
              width={HERO.width}
              height={HERO.height}
              sizes="100vw"
              priority
              fetchPriority="high"
            />
          </div>
          <div className="hero-veil" aria-hidden="true" />
          <div className="hero-copy">
            <p className="brand">{name}</p>
            <h1>The studio platform for real estate photographers.</h1>
            <p className="lede">
              Book the shoot, deliver the gallery, and get paid — on your brand.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup">
                Start 14-day trial
              </Link>
              <Link className="btn btn-ghost" href="/pricing">
                See plans
              </Link>
            </div>
          </div>
        </section>

        <section className="services" id="product">
          <div className="services-inner">
            <div className="section-intro">
              <p className="eyebrow">Product</p>
              <h2>Everything from the first inquiry to the final zip.</h2>
              <p className="section-copy">
                Your site, your calendar, your galleries. Agents open a link.
                They never create an account.
              </p>
            </div>
            <ul className="price-list">
              <li>
                <div>
                  <h3>Grow the job</h3>
                  <p>Instant quotes, packages, and in-gallery add-ons so each listing can earn more.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Run the day</h3>
                  <p>Booking, access notes, and a shoot board that moves from requested to paid.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>See the work</h3>
                  <p>Gallery views and downloads you can forward when an agent needs proof it landed.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Look like the studio</h3>
                  <p>White-label site, branded or clean shares, and listing pages agents send to sellers.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="work" id="delivery">
          <div className="section-intro">
            <p className="eyebrow">Delivery</p>
            <h2>Proofs, pay, and files on the same link.</h2>
            <p className="section-copy">
              Watermarked review until payment. MLS sizes and full-resolution
              downloads unlock in seconds.
            </p>
          </div>
          <div className="platform-band">
            <Image
              src={DELIVERY.src}
              alt={DELIVERY.alt}
              width={DELIVERY.width}
              height={DELIVERY.height}
              sizes="100vw"
            />
          </div>
        </section>

        <section className="process" id="studios">
          <div className="process-inner">
            <div className="section-intro">
              <p className="eyebrow">Studios</p>
              <h2>Fits a solo week and a small crew.</h2>
            </div>
            <ol className="steps steps-two">
              <li data-reveal>
                <span className="step-num">01</span>
                <h3>Working alone</h3>
                <p>
                  A branded site, booking, and gated delivery so you can shoot
                  instead of chasing files over email.
                </p>
              </li>
              <li data-reveal>
                <span className="step-num">02</span>
                <h3>Growing a bench</h3>
                <p>
                  Invite editors, keep one board, and share listing pages that
                  still carry your name — or none at all for MLS.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="services" id="plans">
          <div className="services-inner">
            <div className="section-intro">
              <p className="eyebrow">Plans</p>
              <h2>Start on a trial. Scale when the calendar fills.</h2>
              <p className="section-copy">
                Monthly software for the studio. Agents pay you on the gallery.
              </p>
            </div>
            <ol className="steps">
              {(["starter", "growth", "studio"] as const).map((plan, index) => (
                <li key={plan} data-reveal>
                  <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
                  <h3>
                    {PLAN_DEFS[plan].label} · ${PLAN_DEFS[plan].monthlyUsd}/mo
                  </h3>
                  <p>
                    {PLAN_DEFS[plan].listingQuota} listings / year · {PLAN_DEFS[plan].seats}{" "}
                    seat{PLAN_DEFS[plan].seats === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
            <p className="section-copy" style={{ marginTop: "2rem" }}>
              <Link className="btn btn-solid" href="/pricing#compare">
                Compare plans
              </Link>
            </p>
          </div>
        </section>

        <section className="contact">
          <div className="contact-inner">
            <div className="section-intro">
              <p className="eyebrow">Get started</p>
              <h2>Your brand on the site. Your files in the zip.</h2>
              <p className="section-copy">
                Fourteen days to run a real listing through booking and delivery.
              </p>
            </div>
            <div className="contact-panel">
              <Link className="btn btn-solid" href="/signup">
                Start 14-day trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PlatformFooter />
    </>
  );
}
