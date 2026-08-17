/**
 * Create Stripe webhook (if missing) and print only status + whether secret was obtained.
 * Usage: node scripts/ensure-stripe-webhook.mjs
 * Writes STRIPE_WEBHOOK_SECRET into .env.local when created/found via create response.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

function loadEnv(filename) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(".env.local");

const webhookUrl = "https://studiofront.ca/api/stripe/webhook";
const events = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error("MISSING_STRIPE_SECRET_KEY");
  process.exit(1);
}

if (process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
  console.log("WEBHOOK_SECRET_ALREADY_IN_ENV=1");
  process.exit(0);
}

const listRes = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
  headers: { Authorization: `Bearer ${secretKey}` },
});
const listJson = await listRes.json();
if (listJson.error) {
  console.error("LIST_ERROR=" + listJson.error.message);
  process.exit(1);
}

const existing = (listJson.data ?? []).find((ep) => ep.url === webhookUrl);
if (existing) {
  console.log("WEBHOOK_EXISTS=" + existing.id);
  console.log(
    "NEED_DASHBOARD_SECRET=1 (signing secret only returned on create; delete+recreate or copy from Stripe Dashboard)",
  );
  process.exit(2);
}

const body = new URLSearchParams();
body.set("url", webhookUrl);
for (const event of events) body.append("enabled_events[]", event);

const createRes = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body,
});
const created = await createRes.json();
if (created.error) {
  console.error("CREATE_ERROR=" + created.error.message);
  process.exit(1);
}

const signingSecret = created.secret;
if (!signingSecret) {
  console.error("NO_SIGNING_SECRET_IN_CREATE_RESPONSE");
  process.exit(1);
}

let envText = fs.readFileSync(envPath, "utf8");
if (/^STRIPE_WEBHOOK_SECRET=/m.test(envText)) {
  envText = envText.replace(
    /^STRIPE_WEBHOOK_SECRET=.*$/m,
    `STRIPE_WEBHOOK_SECRET=${signingSecret}`,
  );
} else {
  envText = envText.trimEnd() + `\nSTRIPE_WEBHOOK_SECRET=${signingSecret}\n`;
}
fs.writeFileSync(envPath, envText);
console.log("WEBHOOK_CREATED=" + created.id);
console.log("WEBHOOK_SECRET_WRITTEN_TO_ENV_LOCAL=1");
