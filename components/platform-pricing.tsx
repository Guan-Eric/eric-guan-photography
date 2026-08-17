import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { PLAN_DEFS, entitlements } from "@/lib/billing";
import type { PlanId } from "@/lib/db/schema";

export function PlatformPricing() {
  const plans: Array<Exclude<PlanId, "trial">> = [
    "payg",
    "starter",
    "growth",
    "studio",
  ];
  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Pricing</p>
            <h1>Pay per listing, or go flat as you grow.</h1>
            <p className="section-copy">
              Start at ${PLAN_DEFS.payg.meteredUsd} per listing with no monthly
              fee. Switch to a flat plan once volume makes it cheaper. 14-day
              trial, no agent accounts, cancel anytime.
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
                    <p className="price">
                      {id === "payg" ? `$${def.meteredUsd}/listing` : `$${def.monthlyUsd}/mo`}
                    </p>
                    <p className="package-meta">
                      {id === "payg"
                        ? "USD · no monthly fee · billed in arrears"
                        : "USD · billed monthly"}
                    </p>
                    <ul className="package-includes">
                      <li>
                        {id === "payg"
                          ? "Unlimited listings, pay per shoot"
                          : `${def.listingQuota} listings / year`}
                      </li>
                      <li>
                        {def.seats} team seat{def.seats === 1 ? "" : "s"}
                      </li>
                      <li>White-label site + booking</li>
                      <li>Gated galleries + MLS zips</li>
                      {extras.customDomain ? <li>Custom domain</li> : <li>Subdomain only</li>}
                      {extras.propertyPages ? <li>Property websites</li> : null}
                      {extras.shareKit ? <li>Share kit + reports + upsells</li> : null}
                      {id === "payg" ? null : (
                        <li>${def.meteredUsd} per listing beyond plan</li>
                      )}
                    </ul>
                    <Link className="btn btn-solid" href={`/signup?plan=${id}`}>
                      {id === "payg" ? "Start free" : "Start trial"}
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
