import { NextResponse } from "next/server";
import { requireActiveStudio } from "@/lib/admin-guards";
import { requireTenantMembership } from "@/lib/auth";
import {
  galleryPublicUrl,
  getGalleryByOrderId,
  publishDelivery,
  refreshGalleryLink,
  setGalleryBrandMode,
  unlockGallery,
} from "@/lib/galleries";
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
  const active = await requireActiveStudio(order.tenantId);
  if (!active.ok) {
    return NextResponse.json({ ok: false, error: active.error }, { status: 403 });
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

  if (action === "refresh") {
    const gallery = await getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const result = await refreshGalleryLink(gallery.id, order.tenantId);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
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
    return NextResponse.json({
      ok: true,
      gallery: result.gallery,
      brandedUrl,
      unbrandedUrl,
    });
  }

  if (action === "unlock") {
    const gallery = await getGalleryByOrderId(orderId, order.tenantId);
    if (!gallery) {
      return NextResponse.json({ ok: false, error: "No gallery yet." }, { status: 404 });
    }
    const result = await unlockGallery(gallery.id, {
      markOrderPaid: Boolean(body.markPaid),
    });
    let listingUrl: string | null = null;
    if (result.ok && body.markPaid) {
      const paid = await notifyGalleryPaid({
        tenantId: order.tenantId,
        orderId,
        galleryToken: result.gallery.publicToken,
      });
      listingUrl = paid.listingUrl ?? null;
    } else if (result.ok) {
      await notifyOrderStatusChange({
        tenantId: order.tenantId,
        order: { ...order, status: "delivered" },
        status: "delivered",
        galleryUrl: galleryPublicUrl(
          result.gallery.publicToken,
          "branded",
          tenant.siteUrl,
        ),
      });
    }
    return NextResponse.json({ ...result, listingUrl });
  }

  const result = await publishDelivery(orderId, order.tenantId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

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

  // Listing pages are created on payment, not on gallery publish.
  const emailResults = await notifyOrderStatusChange({
    tenantId: order.tenantId,
    order: { ...order, status: "delivered" },
    status: "delivered",
    galleryUrl: brandedUrl,
  });
  const emailResult = emailResults[0] ?? null;

  return NextResponse.json({
    ok: true,
    gallery: result.gallery,
    brandedUrl,
    unbrandedUrl,
    listingUrl: null,
    listingSkipped: false,
    listingError: null,
    emailSent: Boolean(emailResult?.ok && !("stubbed" in emailResult && emailResult.stubbed)),
    emailStubbed: Boolean(emailResult && "stubbed" in emailResult && emailResult.stubbed),
    emailError:
      emailResult && !emailResult.ok
        ? emailResult.error
        : null,
  });
}
