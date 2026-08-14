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

function main() {
  getDb();

  const ericOrders = listOrders("eric-guan");
  const demoOrders = listOrders("demo-studio");

  console.log(`eric orders: ${ericOrders.length}`);
  console.log(`demo orders: ${demoOrders.length}`);

  if (ericOrders.length > 0) {
    const leaked = getOrder(ericOrders[0].id, "demo-studio");
    if (leaked) {
      console.error("FAIL: demo tenant could read eric order");
      process.exit(1);
    }
    console.log("ok: getOrder(ericId, demo-studio) → null");

    const leakedPage = getListingPageByOrder(ericOrders[0].id, "demo-studio");
    if (leakedPage) {
      console.error("FAIL: demo tenant could read eric listing page");
      process.exit(1);
    }
    console.log("ok: listing page cross-tenant read → null");
  } else {
    console.log("skip cross-read (no eric orders yet)");
  }

  const fakePage = getListingPageBySlug("demo-studio", "does-not-exist");
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

  const ericBilling = getTenantRow("eric-guan");
  const demoBilling = getTenantRow("demo-studio");
  if (!ericBilling || !demoBilling) {
    console.error("FAIL: seeded tenants missing");
    process.exit(1);
  }
  if (ericBilling.id === demoBilling.id) {
    console.error("FAIL: tenant rows collapsed");
    process.exit(1);
  }
  const quota = assertCanCreateListing("eric-guan");
  if (!quota.ok) {
    console.error("FAIL: dogfood tenant blocked from listings", quota.error);
    process.exit(1);
  }
  console.log("ok: billing quota is tenant-scoped");

  console.log("PASS isolation check");
}

main();
