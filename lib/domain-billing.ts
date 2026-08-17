import { and, eq } from "drizzle-orm";
import { DOMAIN_ADDON_USD, recordBillingEvent } from "@/lib/billing";
import { getDb, qAll, schema } from "@/lib/db";
import type { TenantRow } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { getTenantRow } from "@/lib/tenant-store";

/** Cloudflare hostname states that are live enough to bill for. */
const LIVE_STATUSES = new Set(["active", "verified"]);

export function tenantDomainIsBillable(row: TenantRow) {
  if (!row.domain) return false;
  if (!row.domainStatus) return false;
  return LIVE_STATUSES.has(row.domainStatus);
}

export async function listActiveListingDomains(tenantId: string) {
  const db = getDb();
  return qAll<{ id: string; hostname: string; status: string; listingPageId: string }>(
    db
      .select({
        id: schema.listingDomains.id,
        hostname: schema.listingDomains.hostname,
        status: schema.listingDomains.status,
        listingPageId: schema.listingDomains.listingPageId,
      })
      .from(schema.listingDomains)
      .where(eq(schema.listingDomains.tenantId, tenantId)),
  );
}

/**
 * Studio hostname plus every live per-listing hostname. This count is the
 * quantity on the domain add-on subscription item.
 */
export async function countBillableDomains(tenantId: string) {
  const row = await getTenantRow(tenantId);
  if (!row) return 0;
  const listing = await listActiveListingDomains(tenantId);
  const liveListing = listing.filter((domain) => LIVE_STATUSES.has(domain.status));
  return (tenantDomainIsBillable(row) ? 1 : 0) + liveListing.length;
}

function addonPriceId() {
  return process.env.STRIPE_PRICE_DOMAIN_ADDON?.trim() ?? "";
}

/**
 * Push the billable domain count onto the studio subscription as the quantity
 * of the add-on item, creating the item on first use and removing it at zero.
 */
export async function syncDomainAddonQuantity(tenantId: string) {
  const priceId = addonPriceId();
  const stripe = getStripe();
  const row = await getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };

  const quantity = await countBillableDomains(tenantId);

  if (!stripe || !priceId || !row.stripeSubscriptionId) {
    await recordBillingEvent({
      tenantId,
      type: "domain_addon.skipped",
      payload: {
        quantity,
        reason: !stripe
          ? "stripe_disabled"
          : !priceId
            ? "no_price"
            : "no_subscription",
      },
    });
    return { ok: true as const, skipped: true as const, quantity };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    const existing = subscription.items.data.find(
      (item) => item.price?.id === priceId,
    );

    if (!existing && quantity > 0) {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: priceId,
        quantity,
      });
    } else if (existing && quantity === 0) {
      await stripe.subscriptionItems.del(existing.id);
    } else if (existing && existing.quantity !== quantity) {
      await stripe.subscriptionItems.update(existing.id, { quantity });
    }

    await recordBillingEvent({
      tenantId,
      type: "domain_addon.synced",
      stripeId: subscription.id,
      payload: { quantity, unitUsd: DOMAIN_ADDON_USD },
    });
    return { ok: true as const, quantity };
  } catch (error) {
    await recordBillingEvent({
      tenantId,
      type: "domain_addon.failed",
      payload: {
        quantity,
        error: error instanceof Error ? error.message : "sync failed",
      },
    });
    return { ok: false as const, error: "Could not sync domain billing." };
  }
}

export async function getListingDomainByHostname(hostname: string) {
  const db = getDb();
  const rows = await qAll<{
    id: string;
    tenantId: string;
    listingPageId: string;
    hostname: string;
    status: string;
  }>(
    db
      .select({
        id: schema.listingDomains.id,
        tenantId: schema.listingDomains.tenantId,
        listingPageId: schema.listingDomains.listingPageId,
        hostname: schema.listingDomains.hostname,
        status: schema.listingDomains.status,
      })
      .from(schema.listingDomains)
      .where(eq(schema.listingDomains.hostname, hostname.toLowerCase())),
  );
  return rows[0] ?? null;
}

export async function getListingDomainForPage(tenantId: string, listingPageId: string) {
  const db = getDb();
  const rows = await qAll<{
    id: string;
    hostname: string;
    status: string;
    cfId: string | null;
    purchasedByEmail: string | null;
    paidUntil: string | null;
  }>(
    db
      .select({
        id: schema.listingDomains.id,
        hostname: schema.listingDomains.hostname,
        status: schema.listingDomains.status,
        cfId: schema.listingDomains.cfId,
        purchasedByEmail: schema.listingDomains.purchasedByEmail,
        paidUntil: schema.listingDomains.paidUntil,
      })
      .from(schema.listingDomains)
      .where(
        and(
          eq(schema.listingDomains.tenantId, tenantId),
          eq(schema.listingDomains.listingPageId, listingPageId),
        ),
      ),
  );
  return rows[0] ?? null;
}
