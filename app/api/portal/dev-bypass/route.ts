import { NextResponse } from "next/server";
import { z } from "zod";
import { attachAgentSession, portalDevBypassAllowed } from "@/lib/agent-auth";
import { galleryAccessDeniedReason, getGalleryByToken } from "@/lib/galleries";
import { getListingPageByOrder } from "@/lib/listing-pages";
import { getOrder } from "@/lib/orders";
import { requestPublicOrigin, safePortalPath } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  galleryToken: z.string().trim().min(8).max(80),
});

async function galleryTokenFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      galleryToken?: unknown;
    } | null;
    const parsed = bodySchema.safeParse(body);
    return parsed.success ? parsed.data.galleryToken : null;
  }
  const form = await request.formData().catch(() => null);
  const token = form?.get("galleryToken");
  return typeof token === "string" ? token.trim() : null;
}

export async function POST(request: Request) {
  const origin = requestPublicOrigin(request);
  const login = new URL("/portal/login", origin);

  if (!portalDevBypassAllowed()) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const galleryToken = await galleryTokenFromRequest(request);
  if (!galleryToken) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const gallery = await getGalleryByToken(galleryToken);
  if (!gallery || gallery.tenantId !== tenant.id || galleryAccessDeniedReason(gallery)) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const order = await getOrder(gallery.orderId, gallery.tenantId);
  if (!order?.agentEmail) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const listing = await getListingPageByOrder(order.id, tenant.id);
  const next =
    safePortalPath(listing ? `/portal/listings/${listing.id}` : "/portal") ?? "/portal";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.redirect(new URL(next, origin), { status: 303 });
  await attachAgentSession(
    response,
    { tenantId: tenant.id, email: order.agentEmail.trim().toLowerCase() },
    host,
  );
  return response;
}
