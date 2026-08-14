import type { Metadata } from "next";
import Link from "next/link";
import { FaqJsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getTenant } from "@/lib/tenants";

const tenant = getTenant();

export const metadata: Metadata = {
  title: "Pricing",
  description: `Real estate photography packages and pricing. ${tenant.turnaround} delivery, MLS-ready sizes, and full-resolution files included.`,
  alternates: { canonical: "/pricing" },
};

const faqs = [
  {
    question: "How fast do I get the photos?",
    answer: `Standard delivery is ${tenant.turnaround} from the end of the shoot. If you have a listing going live sooner, say so when you book and I will prioritise the edit.`,
  },
  {
    question: "What sizes do I receive?",
    answer:
      "Every gallery includes MLS-sized images ready to upload without resizing, plus full-resolution files for print and flyers. You do not have to convert anything yourself.",
  },
  {
    question: "Do I need to be at the shoot?",
    answer:
      "No. Lockbox or key access is fine. Send access notes when you book and I will confirm everything the day before.",
  },
  {
    question: "What if the home is not ready?",
    answer:
      "Send the seller the pre-shoot checklist ahead of time. I will do light tidying — cords, remotes, trash bins — but I cannot stage or deep clean, and an unprepared home costs shooting time.",
  },
  {
    question: "When do I pay?",
    answer:
      "You receive a review gallery and an invoice on delivery. Full-resolution downloads unlock as soon as the invoice is settled. Repeat agents can move to net-7 billing instead.",
  },
  {
    question: "Can I use the photos after the listing sells?",
    answer:
      "Yes, for marketing the property and your own promotion. Reselling or licensing the images to a third party is not included.",
  },
];

export default function PricingPage() {
  return (
    <>
      <FaqJsonLd items={faqs} />
      <SiteHeader tenant={tenant} solid />

      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Pricing</p>
            <h1>Straightforward packages, no surprises.</h1>
            <p className="section-copy">
              Every package includes editing, MLS-sized and full-resolution
              downloads, and {tenant.turnaround} delivery. Larger or
              higher-end homes are quoted on square footage.
            </p>
          </div>
        </header>

        <section className="page-section">
          <div className="page-inner">
            <div className="package-grid">
              {tenant.packages.map((pkg) => (
                <article
                  key={pkg.id}
                  className={`package-card${pkg.featured ? " is-featured" : ""}`}
                >
                  {pkg.featured ? <span className="badge">Most booked</span> : null}
                  <h3>{pkg.name}</h3>
                  <p className="price">{pkg.price}</p>
                  <p className="package-meta">
                    {pkg.durationMinutes
                      ? `About ${pkg.durationMinutes} minutes on site`
                      : "Scheduled around your listing volume"}
                  </p>
                  <ul className="package-includes">
                    {pkg.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link className="btn btn-solid" href="/#contact">
                    Book {pkg.name.toLowerCase()}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <h2>Common questions</h2>
            <div className="faq">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
