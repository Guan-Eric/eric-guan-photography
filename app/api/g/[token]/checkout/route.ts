import { NextResponse } from "next/server";
import { entitlements } from "@/lib/billing";
import { galleryStubUnlockAllowed } from "@/lib/gallery-stub";
import { getGalleryByToken, galleryHasPaidAccess } from "@/lib/galleries";
import { requestPublicOrigin } from "@/lib/platform";
import {
  createGalleryCheckoutSession,
  localStubUnlock,
  stripeEnabled,
} from "@/lib/stripe";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { token: string };

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { token } = await context.params;
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (await galleryHasPaidAccess(gallery)) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  if (gallery.amountCents <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "This shoot still needs a price from the photographer before checkout.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const origin = requestPublicOrigin(request);
  const successUrl = `${origin}/g/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/g/${token}?cancelled=1`;

  const row = await getTenantRow(gallery.tenantId);
  const addOns: Array<{ name: string; amountCents: number }> = [];
  if (row && entitlements(row.plan).upsells && Array.isArray(body?.addOnIds)) {
    const tenant = await getTenant(gallery.tenantId);
    for (const addOnId of body.addOnIds as string[]) {
      const pkg = tenant.packages.find(
        (item) => item.id === addOnId && item.upsell && item.priceCents,
      );
      if (pkg?.priceCents) addOns.push({ name: pkg.name, amountCents: pkg.priceCents });
    }
  }

  const wantsStub = body?.stub === true;
  if (!stripeEnabled() || wantsStub) {
    if (!galleryStubUnlockAllowed()) {
      return NextResponse.json(
        {
          ok: false,
          error: stripeEnabled()
            ? "Payment is required to unlock this gallery."
            : "Payments are not configured.",
        },
        { status: stripeEnabled() ? 403 : 503 },
      );
    }
    const result = await localStubUnlock(gallery);
    return NextResponse.json({
      ok: true,
      stubbed: true,
      unlocked: result.ok,
    });
  }

  try {
    const session = await createGalleryCheckoutSession({
      gallery,
      successUrl,
      cancelUrl,
      addOns,
    });

    if (!session.ok) {
      return NextResponse.json(
        { ok: false, error: "Could not start checkout. Check Stripe keys." },
        { status: 500 },
      );
    }
    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, stubbed: false, url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checkout.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
