import { NextResponse } from "next/server";
import { entitlements } from "@/lib/billing";
import { getGalleryByToken } from "@/lib/galleries";
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
  if (gallery.state === "unlocked") {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  const body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/g/${token}?paid=1`;
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

  if (!stripeEnabled() || body?.stub === true) {
    const result = await localStubUnlock(gallery);
    return NextResponse.json({
      ok: true,
      stubbed: true,
      unlocked: result.ok,
    });
  }

  const session = await createGalleryCheckoutSession({
    gallery,
    successUrl,
    cancelUrl,
    addOns,
  });

  if (!session.ok) {
    return NextResponse.json({ ok: false, error: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stubbed: false, url: session.url });
}
