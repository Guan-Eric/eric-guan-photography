import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { PLAN_DEFS, entitlements } from "@/lib/plan-defs";
import { PURCHASABLE_PLANS, type PlanId, type PurchasablePlanId } from "@/lib/db/schema";
import {
  formatUsd,
  paygMathCards,
  planCompareRows,
  yearlyCostRows,
  type CompareValue,
} from "@/lib/plan-compare";

function CompareCell({ value }: { value: CompareValue }) {
  if (typeof value === "boolean") {
    return value ? <span className="plan-yes">Yes</span> : <span className="plan-no">—</span>;
  }
  return value;
}

function monthLabel(listings: number) {
  const perMonth = listings / 12;
  const rounded = Number.isInteger(perMonth) ? String(perMonth) : perMonth.toFixed(1);
  return `${listings}/yr · ~${rounded}/mo`;
}

export function PlatformPricing() {
  const plans: Array<Exclude<PlanId, "trial">> = [
    "payg",
    "starter",
    "growth",
    "studio",
  ];
  const payg = PLAN_DEFS.payg.meteredUsd;
  const math = paygMathCards();
  const yearly = yearlyCostRows();
  const featureRows = planCompareRows();

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Pricing</p>
            <h1>Pay per listing, or go flat as you grow.</h1>
            <p className="section-copy">
              Start at {formatUsd(payg)} per listing with no monthly fee. Flat
              plans are {formatUsd(PLAN_DEFS.starter.monthlyUsd)},{" "}
              {formatUsd(PLAN_DEFS.growth.monthlyUsd)}, and{" "}
              {formatUsd(PLAN_DEFS.studio.monthlyUsd)}. 14-day trial, no agent
              accounts, cancel anytime.
            </p>
            <p className="section-copy">
              Prefer one payment? See the{" "}
              <Link href="/lifetime">Lifetime Starter deal</Link> — limited seats,
              hard caps, Starter-like rights.
            </p>
            <a className="compare-jump" href="#compare">
              Compare plans and the PAYG math
            </a>
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
                      {id === "payg"
                        ? `${formatUsd(def.meteredUsd)}/listing`
                        : `${formatUsd(def.monthlyUsd)}/mo`}
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
                        <li>{formatUsd(def.meteredUsd)} per listing beyond plan</li>
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

        <section className="page-section plan-compare-section" id="compare">
          <div className="page-inner page-inner--wide">
            <div className="section-intro">
              <p className="eyebrow">Compare</p>
              <h2>Every plan, side by side.</h2>
              <p className="section-copy">
                Same booking and gated delivery on every plan. Pay as you go
                unlocks the rest because you pay per listing. Flat plans add a
                cap, seats, and extras as the studio grows.
              </p>
            </div>

            <div className="plan-compare-wrap">
              <table className="plan-compare">
                <caption className="sr-only">
                  Feature comparison of Pay as you go, Starter, Growth, and Studio
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Included</th>
                    {PURCHASABLE_PLANS.map((id) => (
                      <th key={id} scope="col">
                        {PLAN_DEFS[id].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {PURCHASABLE_PLANS.map((id) => (
                        <td key={id}>
                          <CompareCell value={row.values[id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="plan-math">
              <div className="section-intro">
                <p className="eyebrow">PAYG math</p>
                <h2>When a flat plan costs less than {formatUsd(payg)} a listing.</h2>
                <p className="section-copy">
                  Twelve months of rent divided by {formatUsd(payg)} is the
                  listing count where that plan first beats pay as you go. Stay
                  on PAYG below that line. Extra listings on a flat plan are{" "}
                  {formatUsd(PLAN_DEFS.starter.meteredUsd)}, not {formatUsd(payg)}.
                </p>
              </div>

              <div className="payg-math-grid">
                {math.map((card) => (
                  <article key={card.plan} className="payg-math-card">
                    <h3>
                      {card.label} · {formatUsd(card.monthlyUsd)}/mo
                    </h3>
                    <p className="price">{card.billBreakEven} listings/year</p>
                    <p className="package-meta">
                      {formatUsd(card.annualUsd)} / year · {card.listingQuota}{" "}
                      included · {formatUsd(card.effectiveUsd)} each if you fill
                      the quota
                    </p>
                    <p>
                      {card.fitsInsideQuota
                        ? `Cheaper than PAYG from ${card.billBreakEven} listings a year, while you are still inside the ${card.listingQuota} included.`
                        : `Rent equals ${card.rentBreakEven} PAYG listings, but only ${card.listingQuota} are included, so PAYG stays cheaper until ${card.billBreakEven} listings a year.`}
                    </p>
                  </article>
                ))}
              </div>

              <div className="plan-compare-wrap">
                <table className="plan-compare">
                  <caption>
                    Yearly software cost at typical volumes. Green cells beat
                    pay as you go at that volume. “Lowest” is the cheapest
                    invoice, which may skip features on higher plans.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Volume</th>
                      {PURCHASABLE_PLANS.map((id) => (
                        <th key={id} scope="col">
                          {PLAN_DEFS[id].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearly.map((row) => (
                      <tr key={row.listings}>
                        <th scope="row">{monthLabel(row.listings)}</th>
                        {PURCHASABLE_PLANS.map((id) => (
                          <td
                            key={id}
                            className={
                              row.cheapest === id || row.beatsPayg[id]
                                ? "is-best"
                                : undefined
                            }
                          >
                            {formatUsd(row.costs[id as PurchasablePlanId])}
                            {row.cheapest === id ? (
                              <span className="plan-best-tag">lowest</span>
                            ) : row.beatsPayg[id] ? (
                              <span className="plan-best-tag">beats PAYG</span>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="plan-math-note">
                Growth and Studio still earn the extra seats, custom domain,
                property websites, share kit, reports, and upsells even when
                Starter plus overage is the cheaper invoice.
              </p>
            </div>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
