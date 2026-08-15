import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { orderStatusLabel } from "@/lib/db/schema";
import { formatSlotInZone, parsePreferredSlotsJson } from "@/lib/preferred-slots";
import { getOrderForPublic } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const metadata: Metadata = {
  title: "Booking received",
  robots: { index: false, follow: false },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ token?: string; local?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const order = await getOrderForPublic(id, token);
  if (!order) notFound();

  const tenant = await getTenant(order.tenantId);
  const row = await getTenantRow(order.tenantId);
  const timeZone = row?.timezone ?? "America/Toronto";
  const preferredSlots = parsePreferredSlotsJson(order.preferredSlotsJson);
  const slotLines =
    preferredSlots.length > 0
      ? preferredSlots.map((slot, index) => {
          const rank = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
          return `${rank}: ${slot.label}`;
        })
      : [formatSlotInZone(order.preferredStart, timeZone)];

  const emailSent = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <SiteHeader tenant={tenant} solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Request received</p>
            <h1>Thanks, {order.agentName.split(" ")[0]}.</h1>
            <p className="section-copy">
              Your shoot request is saved
              {emailSent
                ? ". A confirmation email is on the way, and we’ll confirm the slot shortly."
                : `. We’ll follow up at ${order.agentEmail} to confirm the slot shortly.`}{" "}
              Meanwhile, send the seller prep checklist so the home is ready.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-solid" href="/prep">
                Open seller prep checklist
              </Link>
              <a className="btn btn-outline" href={`mailto:${tenant.email}`}>
                Email {tenant.photographerName}
              </a>
            </div>
          </div>
        </header>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div className="booking-card">
              <h2>Request summary</h2>
              <dl className="summary-list">
                <div>
                  <dt>Reference</dt>
                  <dd>{order.id}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{orderStatusLabel(order.status)}</dd>
                </div>
                <div>
                  <dt>Property</dt>
                  <dd>
                    {order.propertyAddress}
                    {order.city ? `, ${order.city}` : ""} {order.postalCode}
                  </dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>
                    {order.packageName} ·{" "}
                    {formatMoney(order.priceCents, order.currency)} ·{" "}
                    {order.durationMinutes} min · {order.squareFootage} sq ft
                  </dd>
                </div>
                <div>
                  <dt>Preferred times</dt>
                  <dd>
                    {slotLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>
                    {order.occupancy}, {order.accessType}
                    {order.accessNotes ? ` — ${order.accessNotes}` : ""}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter tenant={tenant} />
    </>
  );
}
