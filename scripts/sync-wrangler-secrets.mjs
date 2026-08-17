/**
 * Sync selected keys from .env.local into wrangler secrets (stdin).
 * Prints only key names; never prints values.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const keys = [
  "AUTH_SESSION_SECRET",
  "ADMIN_SESSION_SECRET",
  "ADMIN_PASSWORD",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_STUDIO",
  "STRIPE_PRICE_PAYG_BASE",
  "STRIPE_PRICE_PAYG_LISTING",
  "STRIPE_PRICE_OVERAGE_LISTING",
  "STRIPE_METER_EVENT_LISTINGS",
  "STRIPE_PRICE_DOMAIN_ADDON",
  "GOOGLE_PLACES_API_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_ZONE_ID",
  "CF_SAAS_API_TOKEN",
];

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
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
  env[key] = value;
}

let failed = 0;
for (const key of keys) {
  const value = env[key]?.trim();
  if (!value) {
    console.log("SKIP_MISSING=" + key);
    continue;
  }
  const result = spawnSync("npx", ["wrangler", "secret", "put", key], {
    input: value,
    encoding: "utf8",
    cwd: root,
    shell: true,
  });
  if (result.status !== 0) {
    console.log("FAIL=" + key);
    if (result.stderr) console.log(result.stderr.split("\n").slice(-5).join("\n"));
    failed += 1;
  } else {
    console.log("OK=" + key);
  }
}

process.exit(failed > 0 ? 1 : 0);
