import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { getGalleryByOrderId, listMedia } from "@/lib/galleries";
import { getListingPageByOrder, listingPagePublicUrl } from "@/lib/listing-pages";
import { getOrder } from "@/lib/orders";
import {
  SHARE_PRESETS,
  assertShareKit,
  buildFlyerPdf,
  cropShareImage,
  shareCaptions,
  type SharePreset,
} from "@/lib/share-kit";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id: orderId } = await context.params;
  const order = getOrder(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }
  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const share = assertShareKit(order.tenantId);
  if (!share.ok) {
    return NextResponse.json(share, { status: 403 });
  }

  const tenant = getTenant(order.tenantId);
  const gallery = getGalleryByOrderId(orderId, order.tenantId);
  const media = gallery ? listMedia(gallery.id) : [];
  const page = getListingPageByOrder(orderId, order.tenantId);
  const listingUrl = page ? listingPagePublicUrl(page, tenant.siteUrl) : null;
  const galleryUrl = gallery ? `${tenant.siteUrl}/g/${gallery.publicToken}` : undefined;
  const url = new URL(request.url);
  const preset = url.searchParams.get("preset") as SharePreset | null;
  const flyer = url.searchParams.get("flyer") === "1";

  if (flyer) {
    const pdf = await buildFlyerPdf({
      tenant,
      order,
      asset: media[0] ?? null,
      listingUrl,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${order.id}-flyer.pdf"`,
      },
    });
  }

  if (preset && preset in SHARE_PRESETS) {
    if (!media[0]) {
      return NextResponse.json({ ok: false, error: "Upload photos first." }, { status: 400 });
    }
    const jpg = await cropShareImage(media[0], preset);
    return new NextResponse(new Uint8Array(jpg), {
      headers: { "Content-Type": "image/jpeg" },
    });
  }

  return NextResponse.json({
    ok: true,
    captions: shareCaptions({ tenant, order, listingUrl, galleryUrl }),
    listingUrl,
    galleryUrl,
    presets: Object.keys(SHARE_PRESETS),
  });
}
