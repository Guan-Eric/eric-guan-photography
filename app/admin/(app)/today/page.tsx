import type { Metadata } from "next";
import { ShootDayBoard } from "@/components/shoot-day-board";
import { getPhotographerSession } from "@/lib/auth";
import { getOrder, listTodayAppointments } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

export default async function AdminTodayPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;

  const tenantId = session.activeTenantId;
  const tenant = await getTenant(tenantId);
  const row = await getTenantRow(tenantId);
  const timezone = row?.timezone ?? "America/Toronto";
  const appointments = await listTodayAppointments(tenantId, timezone);

  const items = await Promise.all(
    appointments.map(async (appointment) => {
      const order = await getOrder(appointment.orderId, tenantId);
      const pkg = tenant.packages.find((item) => item.id === order?.packageId);
      return {
        appointment,
        order,
        shotList: pkg?.includes ?? [],
      };
    }),
  );

  return (
    <ShootDayBoard
      timezone={timezone}
      items={items.filter((item) => item.order)}
    />
  );
}
