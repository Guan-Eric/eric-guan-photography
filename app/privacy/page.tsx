import type { Metadata } from "next";
import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Studiofront collects, uses, and stores account, booking, media, payment, and Google Calendar data under PIPEDA and Québec Law 25.",
  alternates: {
    canonical: "/privacy",
    languages: { en: "/privacy", fr: "/fr/privacy" },
  },
};

export default function PrivacyPage() {
  const name = platformName();
  const site = platformPublicUrl().replace(/\/$/, "");

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Legal</p>
            <h1>Privacy Policy</h1>
            <p className="section-copy">Last updated: September 19, 2026</p>
            <p className="section-copy">
              <Link className="text-link" href="/fr/privacy">
                Français
              </Link>
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              This policy describes how {name} ({site}) collects, uses, and
              shares information when you use our software for real estate
              photographers. It is written for Canadian operations under the
              federal Personal Information Protection and Electronic Documents
              Act (PIPEDA) and Québec&rsquo;s Act respecting the protection of
              personal information in the private sector (CQLR c. P-39.1,{" "}
              &ldquo;Law 25&rdquo;).
            </p>

            <h2>Person in charge of the protection of personal information</h2>
            <p>
              The person in charge of the protection of personal information for{" "}
              {name} is the Privacy Officer. Title: Privacy Officer. Contact:{" "}
              <a href="mailto:privacy@studiofront.ca">privacy@studiofront.ca</a>{" "}
              (or{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a> if
              that mailbox is unavailable). You may contact this person to
              exercise access, correction, or other privacy rights.
            </p>

            <h2>Who this applies to</h2>
            <p>
              Photographers and studio team members who create a {name}{" "}
              account; agents and sellers who book shoots or open gallery and
              listing links you send them.
            </p>

            <h2>Information we collect</h2>
            <ul>
              <li>
                <strong>Account data:</strong> name, email, password hash, studio
                name, and settings you enter.
              </li>
              <li>
                <strong>Booking and delivery data:</strong> property details,
                agent contact information, access notes, shoot times, gallery
                views and downloads (first-party product events).
              </li>
              <li>
                <strong>Media:</strong> photos and files you upload, stored to
                deliver galleries and listing pages.
              </li>
              <li>
                <strong>Billing data:</strong> Stripe customer, subscription, and
                Connect identifiers. We do not store full card numbers.
              </li>
              <li>
                <strong>Google Calendar (optional):</strong> if you connect
                Google, we receive an OAuth token, your Google account email,
                calendar list, and calendar event data needed to create or
                update Studiofront shoot events and, if you enable it, treat
                other events as busy for booking.
              </li>
              <li>
                <strong>Marketing analytics (cookieless):</strong> on the
                Studiofront marketing site only, we use Cloudflare Web Analytics
                to count page views. It does not use cookies and does not run on
                photographer studio sites or agent gallery links. We do not use
                third-party advertising pixels or session-replay tools.
              </li>
              <li>
                <strong>Session cookies:</strong> necessary cookies for
                photographer and agent sign-in. These are required to operate the
                service and are not used for profiling.
              </li>
            </ul>

            <h2>How we use information</h2>
            <p>We use this information only to operate {name}:</p>
            <ul>
              <li>create and sign in to studios;</li>
              <li>take bookings, send reminders, and deliver galleries;</li>
              <li>process subscriptions and payouts through Stripe;</li>
              <li>
                sync confirmed or requested shoots to a connected Google Calendar
                and read busy times when you turn that setting on.
              </li>
            </ul>
            <p>
              We do not sell personal information. We do not use Google user
              data for advertising, credit decisions, or unrelated AI/training
              products. Google Calendar data is used only to provide the
              calendar features you enable in the studio admin.
            </p>

            <h2>Technology that identifies, locates, or profiles</h2>
            <p>
              Under Law 25, functions that identify, locate, or profile a person
              must be disabled by default, with clear information on how to
              activate them. {name} does not currently offer such profiling or
              advertising trackers. If we introduce them later, they will remain
              off by default until you opt in.
            </p>

            <h2>Communication outside Québec</h2>
            <p>
              Personal information may be processed by providers outside Québec
              (and outside Canada) as listed below. Before those transfers we
              assess privacy impacts for the project (privacy impact assessment
              under s. 3.3) covering purpose, sensitivity, and contractual
              safeguards with Stripe, Resend, Cloudflare, Neon, and Google.
            </p>

            <h2>Google API Limited Use</h2>
            <p>
              {name}&rsquo;s use of information received from Google APIs
              adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We request calendar
              event and calendar-list access so a photographer can keep
              Studiofront bookings on their Google Calendar. You can disconnect
              Google at any time in studio settings; we then delete stored
              OAuth tokens for that studio.
            </p>

            <h2>Processors</h2>
            <ul>
              <li>Payments and Connect: Stripe</li>
              <li>Transactional email: Resend</li>
              <li>Hosting and media storage: Cloudflare Workers and R2</li>
              <li>Marketing analytics: Cloudflare Web Analytics (apex only)</li>
              <li>Database: Neon Postgres</li>
              <li>Optional calendar sync: Google</li>
            </ul>

            <h2>Retention</h2>
            <p>
              Account and studio data stay until you delete the studio or ask us
              to remove it. You can revoke a gallery at any time. Full-resolution
              files should be archived after about 90 days as a studio policy;
              the platform does not auto-delete media yet. Calendar tokens are
              kept only while Google remains connected.
            </p>

            <h2>Your choices</h2>
            <p>
              Email the Privacy Officer at{" "}
              <a href="mailto:privacy@studiofront.ca">privacy@studiofront.ca</a>{" "}
              to access, correct, or delete personal data we hold. Agents who
              received a gallery link should contact the photographer who sent
              it. Complaints about Québec privacy compliance may also be
              directed to the Commission d&rsquo;accès à l&rsquo;information du
              Québec.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
