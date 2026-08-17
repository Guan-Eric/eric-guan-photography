import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
  deleteCustomHostname,
  getCustomHostname,
  isCustomHostnameLive,
  upsertCustomHostname,
} from "@/lib/cloudflare-saas";
import {
  expectedDomainTarget,
  normalizeCustomDomain,
  verifyCustomDomain,
} from "@/lib/custom-domain";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { ListingDomain, ListingPage } from "@/lib/db/schema";
import { syncDomainAddonQuantity } from "@/lib/domain-billing";
import { getListingPage } from "@/lib/listing-pages";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getTenantRow, platformFeeAmountCents } from "@/lib/tenant-store";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
export const DEFAULT_LISTING_DOMAIN_PRICE_CENTS = 4900;

function nowIso() {
  return new Date().toISOString();
}

export async function upsertListingDomain(options: {
  tenantId: string;
  listingPageId: string;
  hostname: string;
}) {
  const hostname = normalizeCustomDomain(options.hostname);
  if (!hostname) return { ok: false as const, error: "Enter a hostname." };

  const page = await getListingPage(options.listingPageId, options.tenantId);
  if (!page) return { ok: false as const, error: "Listing not found." };

  const db = getDb();
  const clash =
    (await qGet<ListingDomain>(
      db.select().from(schema.listingDomains).where(eq(schema.listingDomains.hostname, hostname)),
    )) ?? null;
  if (clash && clash.listingPageId !== options.listingPageId) {
    return { ok: false as const, error: "That hostname is already in use." };
  }

  const verification = await verifyCustomDomain(hostname);
  const cf = await upsertCustomHostname(hostname);
  const cfId = cf.ok && !cf.skipped && cf.data ? cf.data.id : null;
  const live = cf.ok && !cf.skipped && isCustomHostnameLive(cf.data) && verification.verified;
  const status = live ? "active" : verification.verified ? "verified" : "pending";
  const existing =
    (await qGet<ListingDomain>(
      db
        .select()
        .from(schema.listingDomains)
        .where(
          and(
            eq(schema.listingDomains.tenantId, options.tenantId),
            eq(schema.listingDomains.listingPageId, options.listingPageId),
          ),
        ),
    )) ?? null;

  const stamp = nowIso();
  if (existing) {
    await qRun(
      db
        .update(schema.listingDomains)
        .set({
          hostname,
          cfId: cfId ?? existing.cfId,
          status,
          updatedAt: stamp,
        })
        .where(eq(schema.listingDomains.id, existing.id)),
    );
  } else {
    await qRun(
      db.insert(schema.listingDomains).values({
        id: `ld_${id()}`,
        tenantId: options.tenantId,
        listingPageId: options.listingPageId,
        hostname,
        cfId,
        status,
        purchasedByEmail: null,
        paidUntil: null,
        createdAt: stamp,
        updatedAt: stamp,
      }),
    );
  }

  await syncDomainAddonQuantity(options.tenantId);
  return {
    ok: true as const,
    hostname,
    status,
    expectedTarget: expectedDomainTarget(),
    note: verification.message,
  };
}

export async function removeListingDomain(tenantId: string, listingPageId: string) {
  const db = getDb();
  const existing =
    (await qGet<ListingDomain>(
      db
        .select()
        .from(schema.listingDomains)
        .where(
          and(
            eq(schema.listingDomains.tenantId, tenantId),
            eq(schema.listingDomains.listingPageId, listingPageId),
          ),
        ),
    )) ?? null;
  if (!existing) return { ok: true as const };

  if (existing.cfId) await deleteCustomHostname(existing.cfId);
  await qRun(
    db.delete(schema.listingDomains).where(eq(schema.listingDomains.id, existing.id)),
  );
  await syncDomainAddonQuantity(tenantId);
  return { ok: true as const };
}

export async function refreshListingDomain(tenantId: string, listingPageId: string) {
  const db = getDb();
  const existing =
    (await qGet<ListingDomain>(
      db
        .select()
        .from(schema.listingDomains)
        .where(
          and(
            eq(schema.listingDomains.tenantId, tenantId),
            eq(schema.listingDomains.listingPageId, listingPageId),
          ),
        ),
    )) ?? null;
  if (!existing) return { ok: true as const, domain: null };

  const verification = await verifyCustomDomain(existing.hostname);
  let status = existing.status;
  if (existing.cfId) {
    const cf = await getCustomHostname(existing.cfId);
    const live = cf.ok && !cf.skipped && isCustomHostnameLive(cf.data) && verification.verified;
    status = live ? "active" : verification.verified ? "verified" : "pending";
    await qRun(
      db
        .update(schema.listingDomains)
        .set({ status, updatedAt: nowIso() })
        .where(eq(schema.listingDomains.id, existing.id)),
    );
  }
  await syncDomainAddonQuantity(tenantId);
  return {
    ok: true as const,
    domain: { ...existing, status },
    expectedTarget: expectedDomainTarget(),
    note: verification.message,
  };
}

export async function markListingDomainPaid(options: {
  listingPageId: string;
  tenantId: string;
  email: string;
}) {
  const db = getDb();
  const paidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await qRun(
    db
      .update(schema.listingDomains)
      .set({
        purchasedByEmail: options.email.toLowerCase(),
        paidUntil,
        updatedAt: nowIso(),
      })
      .where(
        and(
          eq(schema.listingDomains.tenantId, options.tenantId),
          eq(schema.listingDomains.listingPageId, options.listingPageId),
        ),
      ),
  );
}

export async function createListingDomainCheckout(options: {
  tenantId: string;
  listingPage: ListingPage;
  successUrl: string;
  cancelUrl: string;
  buyerEmail?: string;
}) {
  const amount = DEFAULT_LISTING_DOMAIN_PRICE_CENTS;
  if (!stripeEnabled()) {
    await markListingDomainPaid({
      listingPageId: options.listingPage.id,
      tenantId: options.tenantId,
      email: options.buyerEmail ?? options.listingPage.agentEmail,
    });
    return { ok: true as const, stubbed: true as const };
  }

  const stripe = getStripe()!;
  const row = await getTenantRow(options.tenantId);
  const fee = platformFeeAmountCents(amount);
  const connectAccountId = row?.stripeConnectAccountId;
  const useConnect =
    Boolean(connectAccountId) && row?.stripeConnectStatus === "complete";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    customer_email: options.buyerEmail ?? options.listingPage.agentEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: amount,
          product_data: {
            name: `Custom domain — ${options.listingPage.propertyAddress}`,
            description: "One year of a vanity hostname for this listing page.",
          },
        },
      },
    ],
    metadata: {
      kind: "listing_domain",
      tenantId: options.tenantId,
      listingPageId: options.listingPage.id,
      email: options.buyerEmail ?? options.listingPage.agentEmail,
    },
    ...(useConnect
      ? {
          payment_intent_data: {
            application_fee_amount: fee,
            transfer_data: { destination: connectAccountId! },
          },
        }
      : {}),
  });

  return { ok: true as const, stubbed: false as const, url: session.url };
}
