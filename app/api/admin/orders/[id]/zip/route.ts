import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import { buildGalleryZip } from "@/lib/gallery-zip";
import { getGalleryByOrderId, listMedia } from "@/lib/galleries";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { id: string };

export async function GET(
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
    return NextResponse.json({ ok: false, error: "Upload photos first." }, { status: 404 });
  }

  const media = await listMedia(gallery.id);
  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: "No photos." }, { status: 404 });
  }

  const kind = new URL(request.url).searchParams.get("kind") === "full" ? "full" : "mls";
  const zip = await buildGalleryZip({
    gallery,
    media,
    kind,
    branded: false,
  });

  const slug = order.propertyAddress.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-${kind}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
