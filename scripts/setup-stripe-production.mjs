/**
 * Provision all Stripe products, prices, meter, and production webhook (live mode).
 *
 * Usage:
 *   1. Copy docs/env-stripe-live.example → .env.stripe.live
 *   2. Paste sk_live_... and pk_live_... from Stripe Dashboard
 *   3. node scripts/setup-stripe-production.mjs
 *
 * Or: STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-production.mjs
 *
 * Options:
 *   --sync-wrangler   Push keys to Cloudflare Worker secrets after provisioning
 *   --allow-test      Allow sk_test_ (dev parity only)
 */
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const syncWrangler = args.has("--sync-wrangler");
const allowTest = args.has("--allow-test");

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

function setEnvKey(file, key, value) {
  const full = path.join(root, file);
  const lines = fs.existsSync(full)
    ? fs.readFileSync(full, "utf8").split(/\r?\n/)
    : [];
  let found = false;
  const out = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*#?\\s*${key}\\s*=`))) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push(`${key}=${value}`);
  }
  fs.writeFileSync(full, `${out.join("\n").replace(/\n+$/, "")}\n`);
}

function form(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, form(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => Object.assign(out, form({ [i]: item }, key)));
    } else if (v !== undefined) {
      out[key] = String(v);
    }
  }
  return out;
}

const env = {
  ...loadEnv(".env.local"),
  ...loadEnv(".env.stripe.live"),
  ...process.env,
};

async function promptForLiveKeys() {
  const liveFile = path.join(root, ".env.stripe.live");
  if (!fs.existsSync(liveFile)) {
    fs.copyFileSync(path.join(root, "docs/env-stripe-live.example"), liveFile);
    console.log("CREATED=.env.stripe.live");
  }
  const rl = createInterface({ input, output });
  try {
    console.log(
      "\nPaste live keys from https://dashboard.stripe.com/apikeys (Live mode ON).\n",
    );
    const sk = (await rl.question("STRIPE_SECRET_KEY (sk_live_...): ")).trim();
    const pk = (await rl.question("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_...): ")).trim();
    if (!sk.startsWith("sk_live_")) {
      throw new Error("Expected sk_live_... secret key.");
    }
    if (!pk.startsWith("pk_live_")) {
      throw new Error("Expected pk_live_... publishable key.");
    }
    setEnvKey(".env.stripe.live", "STRIPE_SECRET_KEY", sk);
    setEnvKey(".env.stripe.live", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", pk);
    env.STRIPE_SECRET_KEY = sk;
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk;
  } finally {
    rl.close();
  }
}

if (!env.STRIPE_SECRET_KEY?.trim() || (!allowTest && !env.STRIPE_SECRET_KEY.startsWith("sk_live"))) {
  if (!process.stdin.isTTY) {
    console.error(
      "LIVE_KEY_REQUIRED — create .env.stripe.live from docs/env-stripe-live.example or pass STRIPE_SECRET_KEY=sk_live_...",
    );
    process.exit(1);
  }
  await promptForLiveKeys();
}

const secret = env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error("NO_STRIPE_SECRET — add sk_live_... to .env.stripe.live (see .env.stripe.live.example)");
  process.exit(1);
}

const live = secret.startsWith("sk_live");
if (!live && !allowTest) {
  console.error("LIVE_KEY_REQUIRED — use sk_live_... in .env.stripe.live or pass --allow-test for test mode");
  process.exit(1);
}
console.log(`STRIPE_MODE=${live ? "live" : "test"}`);

const WEBHOOK_URL = "https://studiofront.ca/api/stripe/webhook";
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];

const TIER_PRODUCTS = [
  { name: "Starter", unitAmount: 4900, key: "STRIPE_PRICE_STARTER", nickname: "Starter $49/mo" },
  { name: "Growth", unitAmount: 9900, key: "STRIPE_PRICE_GROWTH", nickname: "Growth $99/mo" },
  { name: "Studio", unitAmount: 14900, key: "STRIPE_PRICE_STUDIO", nickname: "Studio $149/mo" },
];

async function stripe(method, pathname, body) {
  const res = await fetch(`https://api.stripe.com/v1${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2025-04-30.basil",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || JSON.stringify(json));
  }
  return json;
}

async function ensureProduct(name) {
  const list = await stripe("GET", "/products?limit=100&active=true");
  return (
    (list.data || []).find((p) => p.name === name) ||
    (await stripe("POST", "/products", form({ name })))
  );
}

async function ensureRecurringPrice(productId, unitAmount, nickname, key) {
  if (env[key]) {
    try {
      const p = await stripe("GET", `/prices/${env[key]}`);
      if (p?.id && p.active) {
        console.log(`PRICE_KEEP=${key}=${p.id}`);
        return p.id;
      }
    } catch {
      /* recreate */
    }
  }
  const price = await stripe(
    "POST",
    "/prices",
    form({
      product: productId,
      currency: "usd",
      unit_amount: String(unitAmount),
      recurring: { interval: "month" },
      nickname,
    }),
  );
  console.log(`PRICE_NEW=${key}=${price.id}`);
  return price.id;
}

async function ensureOneTimePrice(productId, unitAmount, nickname, key) {
  if (env[key]) {
    try {
      const p = await stripe("GET", `/prices/${env[key]}`);
      if (p?.id && p.active) {
        console.log(`PRICE_KEEP=${key}=${p.id}`);
        return p.id;
      }
    } catch {
      /* recreate */
    }
  }
  const price = await stripe(
    "POST",
    "/prices",
    form({
      product: productId,
      currency: "usd",
      unit_amount: String(unitAmount),
      nickname,
    }),
  );
  console.log(`PRICE_NEW=${key}=${price.id}`);
  return price.id;
}

async function ensureMeteredPrice(productId, unitAmount, nickname, meterId, key) {
  if (env[key]) {
    try {
      const p = await stripe("GET", `/prices/${env[key]}`);
      if (p?.id && p.active) {
        console.log(`PRICE_KEEP=${key}=${p.id}`);
        return p.id;
      }
    } catch {
      /* recreate */
    }
  }
  const price = await stripe(
    "POST",
    "/prices",
    form({
      product: productId,
      currency: "usd",
      unit_amount: String(unitAmount),
      recurring: {
        interval: "month",
        usage_type: "metered",
        meter: meterId,
      },
      nickname,
    }),
  );
  console.log(`PRICE_NEW=${key}=${price.id}`);
  return price.id;
}

// --- Meter ---
let meterEventName = env.STRIPE_METER_EVENT_LISTINGS || "listing_completed";
const meters = await stripe("GET", "/billing/meters?limit=100");
let meter =
  (meters.data || []).find(
    (m) =>
      m.event_name === meterEventName || m.display_name === "Listing completed",
  ) || null;

if (meter) {
  meterEventName = meter.event_name;
  console.log(`METER_EXISTING=${meter.id}`);
} else {
  meter = await stripe(
    "POST",
    "/billing/meters",
    form({
      display_name: "Listing completed",
      event_name: meterEventName,
      default_aggregation: { formula: "sum" },
      customer_mapping: {
        event_payload_key: "stripe_customer_id",
        type: "by_id",
      },
      value_settings: { event_payload_key: "value" },
    }),
  );
  console.log(`METER_CREATED=${meter.id}`);
}

// --- Subscription tiers ---
const ids = {};
for (const tier of TIER_PRODUCTS) {
  const product = await ensureProduct(tier.name);
  ids[tier.key] = await ensureRecurringPrice(
    product.id,
    tier.unitAmount,
    tier.nickname,
    tier.key,
  );
}

// --- PAYG / overage / domain ---
const paygProduct = await ensureProduct("Pay as you go");
const overageProduct = await ensureProduct("Listing overage");
const domainProduct = await ensureProduct("Custom domain add-on");

Object.assign(ids, {
  STRIPE_METER_EVENT_LISTINGS: meterEventName,
  STRIPE_PRICE_PAYG_BASE: await ensureRecurringPrice(
    paygProduct.id,
    0,
    "PAYG base $0/mo",
    "STRIPE_PRICE_PAYG_BASE",
  ),
  STRIPE_PRICE_PAYG_LISTING: await ensureMeteredPrice(
    paygProduct.id,
    500,
    "PAYG listing $5",
    meter.id,
    "STRIPE_PRICE_PAYG_LISTING",
  ),
  STRIPE_PRICE_OVERAGE_LISTING: await ensureMeteredPrice(
    overageProduct.id,
    300,
    "Listing overage $3",
    meter.id,
    "STRIPE_PRICE_OVERAGE_LISTING",
  ),
  STRIPE_PRICE_DOMAIN_ADDON: await ensureRecurringPrice(
    domainProduct.id,
    500,
    "Domain add-on $5/mo",
    "STRIPE_PRICE_DOMAIN_ADDON",
  ),
});

const lifetimeProduct = await ensureProduct("Lifetime Starter");
ids.STRIPE_PRICE_LIFETIME = await ensureOneTimePrice(
  lifetimeProduct.id,
  19900,
  "Lifetime Starter $199",
  "STRIPE_PRICE_LIFETIME",
);

// --- Webhook ---
let webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const hooks = await stripe("GET", "/webhook_endpoints?limit=100");
let hook = (hooks.data ?? []).find((ep) => ep.url === WEBHOOK_URL);

if (hook) {
  console.log(`WEBHOOK_EXISTING=${hook.id}`);
  if (!webhookSecret) {
    console.log(
      "WEBHOOK_SECRET_MISSING=1 Copy signing secret from Stripe Dashboard → Developers → Webhooks",
    );
  }
} else {
  const body = form({ url: WEBHOOK_URL });
  WEBHOOK_EVENTS.forEach((event, i) => {
    body[`enabled_events[${i}]`] = event;
  });
  hook = await stripe("POST", "/webhook_endpoints", body);
  webhookSecret = hook.secret ?? "";
  console.log(`WEBHOOK_CREATED=${hook.id}`);
}

if (webhookSecret) {
  ids.STRIPE_WEBHOOK_SECRET = webhookSecret;
}

// --- Persist ---
if (live) {
  ids.STRIPE_SECRET_KEY = secret;
  if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    ids.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim();
  }
  if (webhookSecret) ids.STRIPE_WEBHOOK_SECRET = webhookSecret;

  for (const [k, v] of Object.entries(ids)) {
    setEnvKey(".env.stripe.live", k, v);
    setEnvKey(".env.local", k, v);
    setEnvKey(".dev.vars", k, v);
  }
  console.log(`ENV_UPDATED=.env.stripe.live keys=${Object.keys(ids).join(",")}`);
} else {
  for (const [k, v] of Object.entries(ids)) {
    setEnvKey(".env.local", k, v);
    setEnvKey(".dev.vars", k, v);
  }
  console.log(`ENV_UPDATED=test keys=${Object.keys(ids).join(",")} (.env.stripe.live unchanged)`);
}

// --- wrangler.jsonc publishable key (public, live only) ---
if (live && ids.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live")) {
  const wranglerPath = path.join(root, "wrangler.jsonc");
  let wranglerText = fs.readFileSync(wranglerPath, "utf8");
  const pk = ids.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (wranglerText.includes('"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"')) {
    wranglerText = wranglerText.replace(
      /"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"\s*:\s*"[^"]*"/,
      `"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "${pk}"`,
    );
  } else {
    wranglerText = wranglerText.replace(
      /"R2_FORCE_REMOTE": "1"/,
      `"R2_FORCE_REMOTE": "1",\n    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "${pk}"`,
    );
  }
  fs.writeFileSync(wranglerPath, wranglerText);
  console.log("WRANGLER_PUBLISHABLE_KEY=updated");
}

if (syncWrangler) {
  // Merge live env into a temp file for sync script
  const syncEnv = path.join(root, ".env.stripe.live");
  const result = spawnSync("node", ["scripts/sync-wrangler-secrets.mjs", "--from", syncEnv], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, STRIPE_ENV_FILE: syncEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log("WRANGLER_SECRETS=synced");
}

console.log("\nNext: node scripts/stripe-activation-check.mjs");
if (live) {
  console.log("Then: node scripts/setup-stripe-production.mjs --sync-wrangler  (if not already)");
  console.log("Then: npm run deploy");
}
