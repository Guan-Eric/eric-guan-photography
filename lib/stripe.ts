import Stripe from "stripe";
import {
  createPaymentRecord,
  unlockGallery,
} from "@/lib/galleries";
import type { Gallery } from "@/lib/db/schema";
import { getTenantRow, platformFeeAmountCents } from "@/lib/tenant-store";

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Cloudflare Workers: Node https client hangs — use fetch.
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createGalleryCheckoutSession(options: {
  gallery: Gallery;
  successUrl: string;
  cancelUrl: string;
  addOns?: Array<{ name: string; amountCents: number }>;
}) {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false as const, stubbed: true as const };
  }

  const tenantRow = await getTenantRow(options.gallery.tenantId);
  const addOnTotal = (options.addOns ?? []).reduce((sum, item) => sum + item.amountCents, 0);
  const applicationFee = platformFeeAmountCents(options.gallery.amountCents + addOnTotal);
  const connectAccountId = tenantRow?.stripeConnectAccountId;
  const useConnect =
    Boolean(connectAccountId) && tenantRow?.stripeConnectStatus === "complete";

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: options.gallery.currency.toLowerCase(),
            unit_amount: options.gallery.amountCents,
            product_data: {
              name: `Listing photos — ${options.gallery.propertyAddress}`,
              description: "Full-resolution + MLS downloads unlock after payment.",
            },
          },
        },
        ...(options.addOns ?? []).map((addOn) => ({
          quantity: 1,
          price_data: {
            currency: options.gallery.currency.toLowerCase(),
            unit_amount: addOn.amountCents,
            product_data: { name: addOn.name },
          },
        })),
      ],
      metadata: {
        kind: "gallery",
        galleryId: options.gallery.id,
        orderId: options.gallery.orderId,
        tenantId: options.gallery.tenantId,
      },
      ...(useConnect
        ? {
            payment_intent_data: {
              application_fee_amount: applicationFee,
              transfer_data: { destination: connectAccountId! },
            },
          }
        : {}),
    },
    useConnect && connectAccountId
      ? undefined
      : undefined,
  );

  await createPaymentRecord({
    tenantId: options.gallery.tenantId,
    gallery: options.gallery,
    provider: "stripe",
    providerSessionId: session.id,
    status: "pending",
  });

  return {
    ok: true as const,
    stubbed: false as const,
    url: session.url,
    sessionId: session.id,
    connect: useConnect,
    applicationFeeCents: applicationFee,
  };
}

/** Local/dev unlock when Stripe keys are absent. */
export async function localStubUnlock(gallery: Gallery) {
  await createPaymentRecord({
    tenantId: gallery.tenantId,
    gallery,
    provider: "local_stub",
    providerSessionId: `local_${Date.now()}`,
    status: "paid",
  });
  const unlocked = await unlockGallery(gallery.id, { markOrderPaid: true });
  if (unlocked.ok) {
    const { notifyGalleryPaid } = await import("@/lib/order-notify");
    await notifyGalleryPaid({
      tenantId: gallery.tenantId,
      orderId: gallery.orderId,
      galleryToken: gallery.publicToken,
    });
  }
  return unlocked;
}
