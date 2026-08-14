import type { Metadata } from "next";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  const name = platformName();
  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Legal</p>
            <h1>Privacy Policy</h1>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              {name} stores photographer accounts, studio settings, booking
              details, gallery media, and payment metadata needed to run the
              product.
            </p>
            <h2>What we collect</h2>
            <p>
              Email and name at signup; studio configuration; order and agent
              contact details you enter; uploaded photos; Stripe customer and
              Connect identifiers; gallery view/download counts.
            </p>
            <h2>Processors</h2>
            <p>
              Payments: Stripe. Email: Resend when configured. Hosting and media:
              your deployment (Cloudflare / R2 in production).
            </p>
            <h2>Retention</h2>
            <p>
              You can revoke a gallery at any time. Full-resolution files should
              be archived after about 90 days as a studio policy; the platform
              does not auto-delete yet.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
