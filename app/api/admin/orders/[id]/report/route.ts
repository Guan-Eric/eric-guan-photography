import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { entitlements } from "@/lib/billing";
import { getGalleryByOrderId } from "@/lib/galleries";
import { galleryReport } from "@/lib/gallery-analytics";
import { getOrder } from "@/lib/orders";
import { getTenantRow } from "@/lib/tenant-store";

export const runtime = "nodejs";

type Params = { id: string };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { id: orderId } = await context.params;
  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }
  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  const row = await getTenantRow(order.tenantId);
  if (!row || !entitlements(row.plan).reports) {
    return NextResponse.json(
      { ok: false, error: "Listing reports are on the Studio plan." },
      { status: 403 },
    );
  }
  const gallery = await getGalleryByOrderId(orderId, order.tenantId);
  if (!gallery) {
    return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    orderId,
    propertyAddress: order.propertyAddress,
    ...(await galleryReport(gallery.id, order.tenantId)),
  });
}
