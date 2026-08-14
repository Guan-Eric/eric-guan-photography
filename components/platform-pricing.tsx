import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { PLAN_DEFS, entitlements } from "@/lib/billing";
import type { PlanId } from "@/lib/db/schema";

export function PlatformPricing() {
  const plans: Array<Exclude<PlanId, "trial">> = ["starter", "growth", "studio"];
  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Pricing</p>
            <h1>Simple monthly plans. Your name on the site.</h1>
            <p className="section-copy">
              14-day Starter trial. Then $49 / $99 / $179 per month. No agent
              accounts. Cancel anytime.
            </p>
          </div>
        </header>
        <section className="page-section">
          <div className="page-inner">
            <div className="package-grid">
              {plans.map((id) => {
                const def = PLAN_DEFS[id];
                const extras = entitlements(id);
                return (
                  <article
                    key={id}
                    className={`package-card${id === "growth" ? " is-featured" : ""}`}
                  >
                    {id === "growth" ? <span className="badge">Most studios</span> : null}
                    <h3>{def.label}</h3>
                    <p className="price">${def.monthlyUsd}/mo</p>
                    <p className="package-meta">USD · billed monthly</p>
                    <ul className="package-includes">
                      <li>{def.listingQuota} listings / year</li>
                      <li>
                        {def.seats} team seat{def.seats === 1 ? "" : "s"}
                      </li>
                      <li>White-label site + booking</li>
                      <li>Gated galleries + MLS zips</li>
                      {extras.customDomain ? <li>Custom domain</li> : <li>Subdomain only</li>}
                      {extras.propertyPages ? <li>Property websites</li> : null}
                      {extras.shareKit ? <li>Share kit + reports + upsells</li> : null}
                    </ul>
                    <Link className="btn btn-solid" href={`/signup?plan=${id}`}>
                      Start trial
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
