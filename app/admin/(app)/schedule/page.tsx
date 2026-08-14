import type { Metadata } from "next";
import { StudioScheduleEditor } from "@/components/studio-schedule-editor";
import { getPhotographerSession } from "@/lib/auth";
import { listOrders } from "@/lib/orders";
import { resolveSchedule } from "@/lib/schedule";
import { getTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule",
  robots: { index: false, follow: false },
};

export default async function AdminSchedulePage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;

  const tenant = getTenant(session.activeTenantId);
  const row = getTenantRow(session.activeTenantId);
  const bookings = listOrders(tenant.id).filter(
    (order) => order.status === "requested" || order.status === "confirmed",
  );

  return (
    <StudioScheduleEditor
      initialSchedule={resolveSchedule(tenant.schedule)}
      timezone={row?.timezone ?? "America/Toronto"}
      bookings={bookings}
    />
  );
}
