/**
 * Isolation smoke test: tenant A must not read tenant B's orders / listing pages,
 * and listing quotas are tenant-scoped.
 * Run: npm run isolation:check
 */
import { assertCanCreateListing } from "../lib/billing";
import { getDb } from "../lib/db";
import { getListingPageByOrder, getListingPageBySlug } from "../lib/listing-pages";
import { getOrder, listOrders } from "../lib/orders";
import { belongsToTenant } from "../lib/isolation";
import { getTenantRow } from "../lib/tenant-store";

async function main() {
  getDb();

  const ericOrders = await listOrders("eric-guan");
  const demoOrders = await listOrders("demo-studio");

  console.log(`eric orders: ${ericOrders.length}`);
  console.log(`demo orders: ${demoOrders.length}`);

  if (ericOrders.length > 0) {
    const leaked = await getOrder(ericOrders[0].id, "demo-studio");
    if (leaked) {
      console.error("FAIL: demo tenant could read eric order");
      process.exit(1);
    }
    console.log("ok: getOrder(ericId, demo-studio) → null");

    const leakedPage = await getListingPageByOrder(ericOrders[0].id, "demo-studio");
    if (leakedPage) {
      console.error("FAIL: demo tenant could read eric listing page");
      process.exit(1);
    }
    console.log("ok: listing page cross-tenant read → null");
  } else {
    console.log("skip cross-read (no eric orders yet)");
  }

  const fakePage = await getListingPageBySlug("demo-studio", "does-not-exist");
  if (fakePage) {
    console.error("FAIL: missing listing page returned");
    process.exit(1);
  }

  const fake = { tenantId: "eric-guan" };
  if (belongsToTenant(fake.tenantId, "demo-studio")) {
    console.error("FAIL: belongsToTenant false positive");
    process.exit(1);
  }
  console.log("ok: belongsToTenant isolation helper");

  const ericBilling = await getTenantRow("eric-guan");
  const demoBilling = await getTenantRow("demo-studio");
  if (!ericBilling || !demoBilling) {
    console.error("FAIL: seeded tenants missing");
    process.exit(1);
  }
  if (ericBilling.id === demoBilling.id) {
    console.error("FAIL: tenant rows collapsed");
    process.exit(1);
  }
  const quota = await assertCanCreateListing("eric-guan");
  if (!quota.ok) {
    console.error("FAIL: dogfood tenant blocked from listings", quota.error);
    process.exit(1);
  }
  console.log("ok: billing quota is tenant-scoped");

  const { getOrCreateReferralCode, getReferralByCode } = await import("../lib/referrals");
  const code = await getOrCreateReferralCode("eric-guan", "iso-agent@example.com");
  const leakedCode = await getReferralByCode("demo-studio", code.code);
  if (leakedCode) {
    console.error("FAIL: demo tenant resolved eric referral code");
    process.exit(1);
  }
  console.log("ok: referral codes are tenant-scoped");

  const { getListingDomainByHostname } = await import("../lib/domain-billing");
  const leakedDomain = await getListingDomainByHostname("missing.example");
  if (leakedDomain) {
    console.error("FAIL: unknown listing domain resolved");
    process.exit(1);
  }
  console.log("ok: listing domains miss is null");

  console.log("PASS isolation check");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
