import type { Order, OrderStatus } from "@/lib/db/schema";
import {
  orderLifecycleEmails,
  orderPriceChangeEmail,
  photographerPriceChangeEmail,
  sendEmail,
  type OutboundEmail,
} from "@/lib/email";
import { galleryPublicUrl, getGalleryByOrderId } from "@/lib/galleries";
import { getOrder } from "@/lib/orders";
import { ensureReviewRequest } from "@/lib/reviews";
import { getTenant } from "@/lib/tenants";
import type { Tenant } from "@/lib/tenant-schema";

function moneyLabel(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency.toUpperCase() || "CAD",
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)} ${currency}`;
  }
}

async function sendAll(mails: OutboundEmail[]) {
  const results = [];
  for (const mail of mails) {
    results.push(await sendEmail(mail));
  }
  return results;
}

export async function notifyOrderStatusChange(options: {
  tenantId: string;
  order: Order;
  status: OrderStatus;
  galleryUrl?: string;
  listingUrl?: string;
  listingCopyUrl?: string;
  scheduledLabel?: string;
}) {
  const tenant = await getTenant(options.tenantId);
  const gallery =
    options.galleryUrl != null
      ? null
      : await getGalleryByOrderId(options.order.id, options.tenantId);
  const galleryUrl =
    options.galleryUrl ??
    (gallery
      ? galleryPublicUrl(gallery.publicToken, "branded", tenant.siteUrl)
      : undefined);

  const mails = orderLifecycleEmails({
    tenant,
    order: options.order,
    status: options.status,
    galleryUrl,
    listingUrl: options.listingUrl,
    listingCopyUrl: options.listingCopyUrl,
    prepUrl: `${tenant.siteUrl.replace(/\/$/, "")}/prep`,
    scheduledLabel: options.scheduledLabel,
    adminUrl: `${tenant.siteUrl.replace(/\/$/, "")}/admin`,
    priceLabel: moneyLabel(options.order.priceCents, options.order.currency),
  });

  return sendAll(mails);
}

export async function notifyGalleryPaid(options: {
  tenantId: string;
  orderId: string;
  galleryToken?: string;
}) {
  const order = await getOrder(options.orderId, options.tenantId);
  if (!order) return { results: [] as Awaited<ReturnType<typeof sendAll>>, listingUrl: null as string | null };
  const tenant = await getTenant(options.tenantId);
  const gallery =
    options.galleryToken != null
      ? null
      : await getGalleryByOrderId(order.id, options.tenantId);
  const token = options.galleryToken ?? gallery?.publicToken;
  const galleryUrl = token
    ? galleryPublicUrl(token, "branded", tenant.siteUrl)
    : undefined;

  await ensureReviewRequest(order.id, options.tenantId);

  const paidOrder = { ...order, status: "paid" as const };
  const { listingCopyUrl, listingPagePublicUrl, publishListingPage } = await import(
    "@/lib/listing-pages"
  );
  const listing = await publishListingPage(paidOrder);
  const listingUrl =
    listing.ok && listing.page
      ? listingPagePublicUrl(listing.page, tenant.siteUrl)
      : null;
  const copyUrl =
    listing.ok && listing.page
      ? listingCopyUrl(listing.page, tenant.siteUrl)
      : null;

  const results = await notifyOrderStatusChange({
    tenantId: options.tenantId,
    order: paidOrder,
    status: "paid",
    galleryUrl,
    listingUrl: listingUrl ?? undefined,
    listingCopyUrl: copyUrl ?? undefined,
  });

  return { results, listingUrl };
}

export async function notifyOrderPriceChange(options: {
  tenant: Tenant;
  order: Order;
  previousPriceCents: number;
}) {
  const previousPriceLabel = moneyLabel(
    options.previousPriceCents,
    options.order.currency,
  );
  const nextPriceLabel = moneyLabel(
    options.order.priceCents,
    options.order.currency,
  );
  return sendAll([
    orderPriceChangeEmail({
      tenant: options.tenant,
      order: options.order,
      previousPriceLabel,
      nextPriceLabel,
    }),
    photographerPriceChangeEmail({
      tenant: options.tenant,
      order: options.order,
      previousPriceLabel,
      nextPriceLabel,
      adminUrl: `${options.tenant.siteUrl.replace(/\/$/, "")}/admin`,
    }),
  ]);
}
