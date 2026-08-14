import type { Metadata } from "next";
import { BookingForm } from "@/components/booking-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireRequestTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Book a listing shoot",
  description:
    "Get an instant quote from square footage, pick an open slot, and send access notes in one request.",
  alternates: { canonical: "/book" },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const tenant = await requireRequestTenant();
  const params = await searchParams;

  return (
    <>
      <SiteHeader tenant={tenant} solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Book</p>
            <h1>Request a shoot with a firm quote.</h1>
            <p className="section-copy">
              Enter the size, pick a package, choose an open slot, and send access
              notes. I&rsquo;ll confirm shortly — no back-and-forth for the basics.
            </p>
          </div>
        </header>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <BookingForm
              packages={tenant.packages}
              defaultPackageId={params.package}
              email={tenant.email}
            />
          </div>
        </section>
      </main>
      <SiteFooter tenant={tenant} />
    </>
  );
}
