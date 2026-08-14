import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { statusUpdateSchema } from "@/lib/booking-schema";
import { orderStatusEmail, sendEmail } from "@/lib/email";
import { galleryPublicUrl, getGalleryByOrderId } from "@/lib/galleries";
import { getOrder, updateOrderStatus } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

export async function PATCH(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id } = await context.params;
  const order = getOrder(id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  const result = updateOrderStatus(id, parsed.data.status, order.tenantId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }

  const tenant = getTenant(order.tenantId);
  const gallery = getGalleryByOrderId(order.id, order.tenantId);
  const mail = orderStatusEmail({
    tenant,
    order: result.order,
    status: parsed.data.status,
    galleryUrl: gallery
      ? galleryPublicUrl(gallery.publicToken, "branded", tenant.siteUrl)
      : undefined,
    prepUrl: `${tenant.siteUrl}/prep`,
  });
  if (mail) await sendEmail(mail);

  return NextResponse.json(result);
}
