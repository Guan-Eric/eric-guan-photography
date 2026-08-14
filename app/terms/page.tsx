import type { Metadata } from "next";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  const name = platformName();
  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Legal</p>
            <h1>Terms of Service</h1>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              {name} is software for real estate photographers. By creating an
              account you agree to these terms.
            </p>
            <h2>Accounts and studios</h2>
            <p>
              You are responsible for your studio&rsquo;s content, bookings, and
              media. Photographers own their uploaded media. Agents access
              galleries by signed link, not by {name} accounts.
            </p>
            <h2>Subscriptions</h2>
            <p>
              Paid plans are billed monthly in USD via Stripe. Listing and seat
              quotas apply per calendar year. Trials last 14 days.
            </p>
            <h2>Acceptable use</h2>
            <p>
              Do not upload malware, infringing media, or content you do not have
              rights to deliver. We may revoke galleries and suspend studios for
              abuse.
            </p>
            <h2>Media license defaults</h2>
            <p>
              Unless a studio states otherwise, agents receive a license to use
              delivered photos to market the photographed property and their own
              services. Resale or sublicensing to unrelated third parties is not
              included.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
