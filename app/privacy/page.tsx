import type { Metadata } from "next";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Studiofront collects, uses, and stores account, booking, media, payment, and Google Calendar data.",
  alternates: { canonical: "/privacy" },
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
            <p className="section-copy">Last updated: August 19, 2026</p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              This policy describes how {name} ({site}) collects, uses, and
              shares information when you use our software for real estate
              photographers. Contact:{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a>.
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
                views and downloads.
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
              Email{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a> to
              access, correct, or delete personal data we hold. Agents who
              received a gallery link should contact the photographer who sent
              it.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
