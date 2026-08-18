import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import {
  galleryPublicUrl,
  getGalleryByOrderId,
  publishDelivery,
  setGalleryBrandMode,
  unlockGallery,
} from "@/lib/galleries";
import {
  listingPagePublicUrl,
  listingCopyUrl,
  publishListingPage,
} from "@/lib/listing-pages";
import {
  notifyGalleryPaid,
  notifyOrderStatusChange,
} from "@/lib/order-notify";
import { getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;
  const tenant = await getTenant(order.tenantId);

  if (action === "brand") {
    const gallery = await getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const mode = body.brandMode === "unbranded" ? "unbranded" : "branded";
    const updated = await setGalleryBrandMode(gallery.id, mode);
    return NextResponse.json({ ok: true, gallery: updated });
  }

  if (action === "unlock") {
    const gallery = await getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const result = await unlockGallery(gallery.id, {
      markOrderPaid: Boolean(body.markPaid),
    });
    if (result.ok && body.markPaid) {
      await notifyGalleryPaid({
        tenantId: order.tenantId,
        orderId,
        galleryToken: gallery.publicToken,
      });
    } else if (result.ok) {
      await notifyOrderStatusChange({
        tenantId: order.tenantId,
        order: { ...order, status: "delivered" },
        status: "delivered",
        galleryUrl: galleryPublicUrl(gallery.publicToken, "branded", tenant.siteUrl),
      });
    }
    return NextResponse.json(result);
  }

  const result = await publishDelivery(orderId, order.tenantId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const listing = await publishListingPage((await getOrder(orderId, order.tenantId))!);
  const publicListingUrl =
    listing.ok && listing.page
      ? listingPagePublicUrl(listing.page, tenant.siteUrl)
      : null;
  const copyUrl =
    listing.ok && listing.page
      ? listingCopyUrl(listing.page, tenant.siteUrl)
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

  const emailResults = await notifyOrderStatusChange({
    tenantId: order.tenantId,
    order: { ...order, status: "delivered" },
    status: "delivered",
    galleryUrl: brandedUrl,
    listingUrl: publicListingUrl ?? undefined,
    listingCopyUrl: copyUrl ?? undefined,
  });
  const emailResult = emailResults[0] ?? null;

  return NextResponse.json({
    ok: true,
    gallery: result.gallery,
    brandedUrl,
    unbrandedUrl,
    listingUrl: publicListingUrl,
    listingSkipped: Boolean(!listing.ok && "skipped" in listing && listing.skipped),
    listingError: listing.ok ? null : listing.error,
    emailSent: Boolean(emailResult?.ok && !("stubbed" in emailResult && emailResult.stubbed)),
    emailStubbed: Boolean(emailResult && "stubbed" in emailResult && emailResult.stubbed),
    emailError:
      emailResult && !emailResult.ok
        ? emailResult.error
        : null,
  });
}
