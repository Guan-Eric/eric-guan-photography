import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import {
  getGalleryByOrderId,
  regenerateGalleryProofs,
} from "@/lib/galleries";
import { getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { id: string };

export async function POST(
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
  const active = await requireActiveStudio(order.tenantId);
  if (!active.ok) {
    return NextResponse.json({ ok: false, error: active.error }, { status: 403 });
  }

  const tenant = await getTenant(order.tenantId);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }

  const gallery = await getGalleryByOrderId(orderId, order.tenantId);
  if (!gallery) {
    return NextResponse.json(
      { ok: false, error: "Upload photos first." },
      { status: 404 },
    );
  }

  const result = await regenerateGalleryProofs(
    order.tenantId,
    gallery.id,
    tenant.studioName,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, regenerated: result.regenerated ?? 0 },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    regenerated: result.regenerated,
    failed: result.failed,
    errors: result.errors,
  });
}
