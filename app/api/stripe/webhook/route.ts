import { NextResponse } from "next/server";
import {
  applyStripeSubscription,
  markSubscriptionPastDue,
  ownerEmailForTenant,
} from "@/lib/billing";
import { billingPaymentFailedEmail, sendEmail } from "@/lib/email";
import { markPaymentPaidBySession } from "@/lib/galleries";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "Stripe not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: !webhookSecret
          ? "Webhook secret not configured."
          : "Missing stripe-signature header.",
      },
      { status: 501 },
    );
  }

  const rawBody = await request.text();
  let event;
  try {
    // Async + WebCrypto — required on Cloudflare Workers.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Webhook signature failed: ${(error as Error).message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.metadata?.kind === "lifetime" && session.metadata.tenantId) {
      const { applyLifetimePurchase } = await import("@/lib/billing");
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      await applyLifetimePurchase({
        tenantId: session.metadata.tenantId,
        customerId,
        sessionId: typeof session.id === "string" ? session.id : null,
      });
    } else if (session.metadata?.kind === "listing_domain" && session.metadata.listingPageId && session.metadata.tenantId) {
      const { markListingDomainPaid } = await import("@/lib/listing-domains");
      await markListingDomainPaid({
        listingPageId: session.metadata.listingPageId,
        tenantId: session.metadata.tenantId,
        email: session.metadata.email ?? session.customer_email ?? "",
      });
    } else if (session.mode === "subscription" && session.subscription) {
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await applyStripeSubscription(sub);
    } else if (typeof session.id === "string") {
      await markPaymentPaidBySession(session.id);
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await applyStripeSubscription(event.data.object);
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      const marked = await markSubscriptionPastDue(customerId);
      if (marked.ok) {
        const row = marked.row;
        let studioName: string | undefined;
        try {
          studioName = (JSON.parse(row.configJson) as { studioName?: string }).studioName;
        } catch {
          studioName = undefined;
        }
        const settingsUrl = `${process.env.PLATFORM_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://studiofront.ca"}/admin/settings`;
        const to =
          invoice.customer_email ??
          (await ownerEmailForTenant(row.id));
        if (to) {
          await sendEmail(
            billingPaymentFailedEmail({
              to,
              settingsUrl,
              studioName,
            }),
          ).catch((error) => {
            console.error("[stripe webhook] payment failed email:", error);
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
