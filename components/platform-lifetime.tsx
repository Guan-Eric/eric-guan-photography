import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { LIFETIME_USD, PLAN_DEFS } from "@/lib/plan-defs";
import { formatUsd } from "@/lib/plan-compare";

type Offer = {
  enabled: boolean;
  open: boolean;
  cap: number;
  sold: number;
  remaining: number;
  priceUsd: number;
  listingQuota: number;
  seats: number;
};

const FAQ = [
  {
    q: "What does “lifetime” mean?",
    a: "Lifetime means access for as long as StudioFront operates the product, under the Lifetime Starter caps below. It is not an unlimited SLA, and it does not include every future enterprise feature.",
  },
  {
    q: "What do I get?",
    a: `Lifetime Starter: white-label subdomain studio site, booking, watermarked proofs, token galleries with pay-to-unlock, and Stripe Connect payouts. Caps: ${PLAN_DEFS.lifetime.listingQuota} listings per year, ${PLAN_DEFS.lifetime.seats} seat, 20 GB storage. No custom domain on this tier.`,
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. If you outgrow the caps or need a custom domain, property pages, or more seats, move to Growth or Studio (monthly) from Settings. Overages are not auto-metered on Lifetime — you upgrade or wait for the next calendar year reset.",
  },
  {
    q: "Is support included?",
    a: "Same product path as subscribers. No custom one-off builds for LTD buyers.",
  },
  {
    q: "What if StudioFront shuts down?",
    a: "Lifetime access lasts while the product operates. We will give reasonable notice and export guidance if that ever changes — we are not promising perpetual hosting with zero risk.",
  },
  {
    q: "How do I buy?",
    a: "Create a studio (or sign in), then complete the one-time Stripe checkout. The deal is limited to the first seats shown on this page.",
  },
] as const;

export function PlatformLifetime({ offer }: { offer: Offer }) {
  const price = formatUsd(offer.priceUsd || LIFETIME_USD);
  const ctaHref = offer.open ? "/signup?plan=lifetime" : "/pricing";
  const ctaLabel = offer.open
    ? `Get Lifetime for ${price}`
    : offer.enabled
      ? "Sold out — see monthly plans"
      : "Offer closed — see monthly plans";

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Founding offer</p>
            <h1>Lifetime Starter — one payment, locked caps.</h1>
            <p className="section-copy">
              Pay once for Starter-like rights while StudioFront operates. Hard
              limits on listings, seats, and storage so this never becomes an
              infinite liability. Limited to {offer.cap} seats.
            </p>
            <div className="hero-actions">
              <Link
                className={`btn btn-solid${!offer.open ? " is-disabled" : ""}`}
                href={ctaHref}
                aria-disabled={!offer.open}
              >
                {ctaLabel}
              </Link>
              <Link className="btn btn-outline" href="/pricing">
                Compare monthly plans
              </Link>
            </div>
            <p className="muted" style={{ marginTop: "1rem" }}>
              {offer.open
                ? `${offer.remaining} of ${offer.cap} Lifetime seats left · ${price} one-time`
                : offer.enabled
                  ? `All ${offer.cap} Lifetime seats are claimed.`
                  : "The Lifetime deal is not open right now."}
            </p>
          </div>
        </header>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div className="package-grid">
              <article className="package-card is-featured">
                <span className="badge">Lifetime</span>
                <h3>{PLAN_DEFS.lifetime.label}</h3>
                <p className="price">{price}</p>
                <p className="package-meta">USD · one-time · while product operates</p>
                <ul>
                  <li>{offer.listingQuota} listings / year (hard cap)</li>
                  <li>{offer.seats} seat</li>
                  <li>20 GB storage</li>
                  <li>Subdomain studio site</li>
                  <li>Booking + gated galleries</li>
                  <li>Pay-to-unlock + Connect payouts</li>
                  <li>No custom domain (upgrade later)</li>
                  <li>No listing overages — upgrade when you outgrow</li>
                </ul>
                <Link className="btn btn-solid" href={ctaHref}>
                  {offer.open ? "Claim Lifetime" : "See monthly plans"}
                </Link>
              </article>

              <article className="package-card">
                <h3>Why not just trial?</h3>
                <p className="package-meta">For studios ready to commit</p>
                <ul>
                  <li>Fund early runway without monthly churn math</li>
                  <li>Same core loop as Starter — not Studio forever</li>
                  <li>Caps keep the deal fair for both sides</li>
                  <li>Upgrade path when volume grows</li>
                </ul>
                <Link className="btn btn-outline" href="/signup">
                  Prefer a 14-day trial
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="page-section" id="faq">
          <div className="page-inner prose">
            <p className="eyebrow">FAQ</p>
            <h2>Lifetime deal questions</h2>
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
