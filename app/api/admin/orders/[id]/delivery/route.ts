import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { orderStatusEmail, sendEmail } from "@/lib/email";
import {
  galleryPublicUrl,
  getGalleryByOrderId,
  publishDelivery,
  setGalleryBrandMode,
  unlockGallery,
} from "@/lib/galleries";
import {
  listingPagePublicUrl,
  publishListingPage,
} from "@/lib/listing-pages";
import { getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;
  const tenant = getTenant(order.tenantId);

  if (action === "brand") {
    const gallery = getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const mode = body.brandMode === "unbranded" ? "unbranded" : "branded";
    const updated = setGalleryBrandMode(gallery.id, mode);
    return NextResponse.json({ ok: true, gallery: updated });
  }

  if (action === "unlock") {
    const gallery = getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const result = unlockGallery(gallery.id, { markOrderPaid: Boolean(body.markPaid) });
    if (result.ok) {
      const galleryUrl = galleryPublicUrl(gallery.publicToken, "branded", tenant.siteUrl);
      const mail = orderStatusEmail({
        tenant,
        order: { ...order, status: "paid" },
        status: "paid",
        galleryUrl,
      });
      if (mail) await sendEmail(mail);
    }
    return NextResponse.json(result);
  }

  const result = publishDelivery(orderId, order.tenantId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const listing = await publishListingPage(getOrder(orderId, order.tenantId)!);
  const listingUrl =
    listing.ok && listing.page
      ? listingPagePublicUrl(listing.page, tenant.siteUrl)
      : null;

  const brandedUrl = galleryPublicUrl(
    result.gallery.publicToken,
    "branded",
    tenant.siteUrl,
  );
  const unbrandedUrl = galleryPublicUrl(
    result.gallery.publicToken,
    "unbranded",
    tenant.siteUrl,
  );

  const mail = orderStatusEmail({
    tenant,
    order: { ...order, status: "delivered" },
    status: "delivered",
    galleryUrl: brandedUrl,
    listingUrl: listingUrl ?? undefined,
    prepUrl: `${tenant.siteUrl}/prep`,
  });
  if (mail) await sendEmail(mail);

  return NextResponse.json({
    ok: true,
    gallery: result.gallery,
    brandedUrl,
    unbrandedUrl,
    listingUrl,
  });
}
