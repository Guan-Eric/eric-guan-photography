/**
 * Create PAYG / overage / domain Stripe prices + meter, write IDs to .env.local.
 *   node scripts/setup-stripe-parity.mjs
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

const env = { ...loadEnv(".env.local"), ...process.env };
const secret = env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("NO_STRIPE_SECRET");
  process.exit(1);
}
console.log(`STRIPE_MODE=${secret.startsWith("sk_live") ? "live" : "test"}`);

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
      if (p?.id) {
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

async function ensureMeteredPrice(productId, unitAmount, nickname, meterId, key) {
  if (env[key]) {
    try {
      const p = await stripe("GET", `/prices/${env[key]}`);
      if (p?.id) {
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

const paygProduct = await ensureProduct("Pay as you go");
const overageProduct = await ensureProduct("Listing overage");
const domainProduct = await ensureProduct("Custom domain add-on");

const ids = {
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
};

for (const [k, v] of Object.entries(ids)) {
  setEnvKey(".env.local", k, v);
  setEnvKey(".dev.vars", k, v);
}

console.log(`ENV_UPDATED keys=${Object.keys(ids).join(",")}`);
