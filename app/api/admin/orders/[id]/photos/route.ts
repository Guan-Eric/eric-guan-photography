import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import {
  getGalleryByOrderId,
  listMedia,
  reorderGalleryMedia,
} from "@/lib/galleries";
import { getOrder } from "@/lib/orders";

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

  const gallery = await getGalleryByOrderId(orderId, order.tenantId);
  if (!gallery) {
    return NextResponse.json({ ok: true, photos: [] });
  }

  const media = await listMedia(gallery.id);
  return NextResponse.json({
    ok: true,
    photos: media.map((asset) => ({
      id: asset.id,
      originalName: asset.originalName,
      roomLabel: asset.roomLabel,
      width: asset.width,
      height: asset.height,
    })),
  });
}

export async function PATCH(
  request: Request,
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

  const gallery = await getGalleryByOrderId(orderId, order.tenantId);
  if (!gallery) {
    return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Send the photo ids in order." }, { status: 400 });
  }

  const result = await reorderGalleryMedia(order.tenantId, gallery.id, ids);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
