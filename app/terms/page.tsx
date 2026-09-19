import type { Metadata } from "next";
import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using Studiofront: accounts, subscriptions, media licenses, MLS use, and liability limits.",
  alternates: {
    canonical: "/terms",
    languages: { en: "/terms", fr: "/fr/terms" },
  },
};

export default function TermsPage() {
  const name = platformName();
  const site = platformPublicUrl().replace(/\/$/, "");

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Legal</p>
            <h1>Terms of Service</h1>
            <p className="section-copy">Last updated: September 19, 2026</p>
            <p className="section-copy">
              <Link className="text-link" href="/fr/terms">
                Français
              </Link>
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              {name} ({site}) is software for real estate photographers. By
              creating an account or using the service you agree to these terms.
              Questions:{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a>.
              This page is product copy and not a substitute for legal advice;
              we recommend independent counsel before treating it as final for
              your practice.
            </p>

            <h2>Accounts and studios</h2>
            <p>
              You must provide accurate signup information and keep your login
              secure. You are responsible for your studio&rsquo;s content,
              bookings, team members, and media. Agents access galleries by
              signed link, not by {name} accounts.
            </p>

            <h2>Subscriptions</h2>
            <p>
              Paid plans are billed monthly in USD via Stripe. Listing and seat
              quotas apply per calendar year. New studios start with a 14-day
              trial unless we state otherwise. You can cancel in billing
              settings; access continues through the current paid period.
            </p>

            <h2>Acceptable use</h2>
            <p>
              Do not upload malware, infringing media, or content you do not
              have rights to deliver. Do not probe other studios&rsquo; data or
              abuse booking, gallery, or payment links. We may revoke galleries
              and suspend studios for abuse.
            </p>

            <h2>Google Calendar</h2>
            <p>
              Connecting Google Calendar is optional. If you connect it, you
              authorize {name} to create and update shoot events on calendars
              you select and, if enabled, read other events as busy times. You
              can disconnect at any time. Google&rsquo;s terms also apply to
              your Google account.
            </p>

            <h2>Copyright</h2>
            <p>
              Photographers retain underlying copyright in media they upload to{" "}
              {name}. The platform does not claim ownership of studio media.
              Galleries and downloads are delivery mechanisms for licenses the
              studio grants to agents.
            </p>

            <h2>Limited marketing license</h2>
            <p>
              Unless a studio grants broader rights in writing, the default
              agent license is a Limited Marketing License: use delivered photos
              only to market the active listing and the agent&rsquo;s own
              services related to that property. It is not a perpetual MLS
              redistribution right, and it does not include resale, transfer to
              another brokerage or listing agent, or reuse after the listing
              expires or is reassigned, unless the studio agrees otherwise.
            </p>

            <h2>MLS and distribution indemnification</h2>
            <p>
              Some MLS boards and marketing systems demand perpetual or
              worldwide licenses. If an agent uploads or submits media obtained
              through {name} into an MLS or other system that requires rights
              beyond the Limited Marketing License, the agent certifies they
              have obtained all necessary rights from the photographer. The
              agent indemnifies {name} and the studio (as a software user) for
              claims arising from that distribution, including copyright and
              license disputes.
            </p>

            <h2>Gallery links and sharing</h2>
            <p>
              Gallery URLs are secret credentials intended for the booking or
              purchasing agent. Links expire (typically after 14 days from
              publish or unlock); studios can refresh links from admin.{" "}
              {name} is not liable for third-party misuse after an agent shares
              their link, screenshots proofs, or otherwise discloses access.
            </p>

            <h2>True Picture, alterations, and AI tools</h2>
            <p>
              Platform tools (editing workflows, future staging or AI features,
              and external exports) are for legitimate aesthetic delivery.
              Users assume all regulatory liability for structural
              misrepresentation of a property—including removing damage,
              inventing features, or deceptive AI edits. {name} does not warrant
              MLS or regulatory compliance of altered images.
            </p>

            <h2>Limitation of liability and uptime</h2>
            <p>
              The service is provided as-is. We aim for high availability but do
              not guarantee uninterrupted access. To the fullest extent
              permitted by law, {name} is not liable for lost real-estate
              commissions, failed showings, missed listing deadlines, or other
              business interruption arising from downtime, expired tokens,
              delivery delays, or link misuse. We are not a party to the
              photographer–agent booking relationship except as a software
              provider.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
