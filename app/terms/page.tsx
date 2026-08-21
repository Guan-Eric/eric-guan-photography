import type { Metadata } from "next";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using Studiofront: accounts, subscriptions, acceptable use, media licenses, and Google Calendar.",
  alternates: { canonical: "/terms" },
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
            <p className="section-copy">Last updated: August 19, 2026</p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              {name} ({site}) is software for real estate photographers. By
              creating an account or using the service you agree to these terms.
              Questions:{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a>.
            </p>

            <h2>Accounts and studios</h2>
            <p>
              You must provide accurate signup information and keep your login
              secure. You are responsible for your studio&rsquo;s content,
              bookings, team members, and media. Photographers own their
              uploaded media. Agents access galleries by signed link, not by{" "}
              {name} accounts.
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

            <h2>Media license defaults</h2>
            <p>
              Unless a studio states otherwise, agents receive a license to use
              delivered photos to market the photographed property and their own
              services. Resale or sublicensing to unrelated third parties is not
              included.
            </p>

            <h2>Disclaimer</h2>
            <p>
              The service is provided as-is. We work to keep it available but do
              not guarantee uninterrupted access. We are not a party to the
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
