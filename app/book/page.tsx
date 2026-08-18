import type { Metadata } from "next";
import { BookingForm } from "@/components/booking-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getTenantRow } from "@/lib/tenant-store";
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
  const row = await getTenantRow(tenant.id);
  const defaultCity =
    tenant.serviceAreas[0]?.city && tenant.serviceAreas[0].city !== "Your market"
      ? tenant.serviceAreas[0].city
      : "";

  return (
    <>
      <SiteHeader tenant={tenant} solid />
      <main id="main">
        <section className="page-section booking-page">
          <div className="page-inner page-inner--booking">
            <BookingForm
              packages={tenant.packages}
              defaultPackageId={params.package}
              email={tenant.email}
              defaultCity={defaultCity}
              timeZone={row?.timezone ?? "America/Toronto"}
              serviceAreaGate={tenant.serviceAreaGate}
              serviceAreaMessage={tenant.serviceAreaGate?.message}
            >
              <header className="booking-page-intro">
                <p className="eyebrow">Book</p>
                <h1>Request a shoot with a firm quote.</h1>
                <p className="section-copy">
                  Enter the size, pick a package, choose an open slot, and send access
                  notes. I&rsquo;ll confirm shortly — no back-and-forth for the basics.
                </p>
              </header>
            </BookingForm>
          </div>
        </section>
      </main>
      <SiteFooter tenant={tenant} />
    </>
  );
}
