/**
 * Report Stripe account activation + Connect readiness.
 * Usage:
 *   node scripts/stripe-activation-check.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-activation-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(filename) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return {};
  const env = {};
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

const env = {
  ...loadEnv(".env.local"),
  ...loadEnv(".env.stripe.live"),
  ...process.env,
};
const secret = env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error("NO_STRIPE_SECRET — set STRIPE_SECRET_KEY or create .env.stripe.live");
  process.exit(1);
}

const live = secret.startsWith("sk_live");
console.log(`STRIPE_MODE=${live ? "live" : "test"}`);

async function stripe(pathname) {
  const res = await fetch(`https://api.stripe.com/v1${pathname}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": "2025-04-30.basil",
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || JSON.stringify(json));
  }
  return json;
}

const account = await stripe("/account");
console.log(`ACCOUNT_ID=${account.id}`);
console.log(`CHARGES_ENABLED=${account.charges_enabled ? 1 : 0}`);
console.log(`PAYOUTS_ENABLED=${account.payouts_enabled ? 1 : 0}`);
console.log(`DETAILS_SUBMITTED=${account.details_submitted ? 1 : 0}`);

const due = account.requirements?.currently_due ?? [];
const pastDue = account.requirements?.past_due ?? [];
if (due.length || pastDue.length) {
  console.log("REQUIREMENTS_DUE=" + [...new Set([...due, ...pastDue])].join(", "));
} else {
  console.log("REQUIREMENTS_DUE=none");
}

const portal = await stripe("/billing_portal/configurations?limit=1");
const portalActive = (portal.data ?? []).some((c) => c.active);
console.log(`CUSTOMER_PORTAL=${portalActive ? "enabled" : "not_configured"}`);

const webhooks = await stripe("/webhook_endpoints?limit=100");
const prodUrl = "https://studiofront.ca/api/stripe/webhook";
const hook = (webhooks.data ?? []).find((ep) => ep.url === prodUrl);
console.log(`WEBHOOK_PRODUCTION=${hook ? hook.id : "missing"}`);

const products = await stripe("/products?limit=100&active=true");
console.log(`PRODUCT_COUNT=${(products.data ?? []).length}`);

let ok = account.charges_enabled && account.details_submitted;
if (!live) {
  console.log("\nWARN  Using test key — re-run with sk_live_... before production go-live.");
  ok = false;
}
if (!hook) ok = false;
if (!portalActive) {
  console.log(
    "WARN  Enable Customer Portal: Stripe Dashboard → Settings → Billing → Customer portal",
  );
}

console.log(ok ? "\nREADY_FOR_LIVE_CHARGES=1" : "\nREADY_FOR_LIVE_CHARGES=0");
process.exit(ok ? 0 : 1);
