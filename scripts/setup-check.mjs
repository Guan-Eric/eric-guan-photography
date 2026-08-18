/**
 * Production env smoke check — prints pass/fail for required secrets.
 * Run: npm run setup:check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(cwd, "..");

function loadEnvFile(filename) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  for (const line of text.split("\n")) {
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function present(...keys) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function check(label, ok, detail) {
  return { label, ok, detail };
}

const r2Ok = present(
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
);

const checks = [
  check(
    "AUTH secrets (ADMIN_SESSION_SECRET + AUTH_SESSION_SECRET)",
    present("ADMIN_SESSION_SECRET", "AUTH_SESSION_SECRET"),
    present("ADMIN_SESSION_SECRET", "AUTH_SESSION_SECRET")
      ? undefined
      : "Set both to long random strings",
  ),
  check(
    "PLATFORM_* (PLATFORM_NAME + PLATFORM_ROOT_DOMAIN)",
    present("PLATFORM_NAME", "PLATFORM_ROOT_DOMAIN"),
  ),
  check(
    "Stripe keys (STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)",
    present("STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  ),
  check(
    "Stripe price IDs (STARTER + GROWTH + STUDIO)",
    present("STRIPE_PRICE_STARTER", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_STUDIO"),
  ),
  check(
    "Stripe webhook secret (STRIPE_WEBHOOK_SECRET)",
    present("STRIPE_WEBHOOK_SECRET"),
  ),
  check(
    "Pay-as-you-go prices (PAYG_BASE + PAYG_LISTING)",
    present("STRIPE_PRICE_PAYG_BASE", "STRIPE_PRICE_PAYG_LISTING"),
    present("STRIPE_PRICE_PAYG_BASE", "STRIPE_PRICE_PAYG_LISTING")
      ? undefined
      : "optional; without these the $0/mo + $5/listing plan is hidden",
  ),
  check(
    "Listing overage price (STRIPE_PRICE_OVERAGE_LISTING)",
    present("STRIPE_PRICE_OVERAGE_LISTING"),
    present("STRIPE_PRICE_OVERAGE_LISTING")
      ? undefined
      : "optional; without it flat tiers hard-block at their listing cap",
  ),
  check(
    "Domain add-on price (STRIPE_PRICE_DOMAIN_ADDON)",
    present("STRIPE_PRICE_DOMAIN_ADDON"),
    present("STRIPE_PRICE_DOMAIN_ADDON")
      ? undefined
      : "optional; without it custom domains are not billed per domain",
  ),
  check(
    "Address lookup (GOOGLE_PLACES_API_KEY)",
    present("GOOGLE_PLACES_API_KEY"),
    present("GOOGLE_PLACES_API_KEY")
      ? undefined
      : "optional; address fields fall back to plain text inputs",
  ),
  check(
    "Google Calendar (GOOGLE_CALENDAR_CLIENT_ID + SECRET)",
    present("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"),
    present("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET")
      ? undefined
      : "optional; Schedule page shows connect once these are set",
  ),
  check(
    "Resend (RESEND_API_KEY)",
    present("RESEND_API_KEY"),
    present("RESEND_API_KEY") ? undefined : "Without this, email logs to console only",
  ),
  check("CRON_SECRET", present("CRON_SECRET")),
  check(
    "R2 (CLOUDFLARE_R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET/BUCKET)",
    r2Ok,
    r2Ok
      ? process.env.R2_FORCE_REMOTE === "1"
        ? "configured (FORCE_REMOTE=1)"
        : "configured (local mirror still on — set R2_FORCE_REMOTE=1 for prod)"
      : "optional locally; required for multi-tenant production media",
  ),
  check(
    "DATABASE_URL (Postgres / Neon)",
    present("DATABASE_URL"),
    present("DATABASE_URL")
      ? "present — Neon path used at runtime"
      : "optional locally (SQLite); required for Cloudflare production",
  ),
  check(
    "PLATFORM_EMAIL_FROM",
    present("PLATFORM_EMAIL_FROM") || present("EMAIL_FROM"),
    present("PLATFORM_EMAIL_FROM") || present("EMAIL_FROM")
      ? undefined
      : "e.g. Studiofront <hello@studiofront.ca>",
  ),
  check(
    "Custom domains (CLOUDFLARE_ZONE_ID + CF_SAAS_API_TOKEN)",
    present("CLOUDFLARE_ZONE_ID", "CF_SAAS_API_TOKEN"),
    present("CLOUDFLARE_ZONE_ID", "CF_SAAS_API_TOKEN")
      ? "configured — Custom Hostname provisioning enabled"
      : "optional until vanity domains; DNS save still works, SSL attach skipped",
  ),
];

let failed = 0;
for (const item of checks) {
  const mark = item.ok ? "PASS" : "FAIL";
  // Custom domains are optional — warn only
  const isOptional =
    (item.label.startsWith("Custom domains") ||
      item.label.startsWith("Google Calendar") ||
      item.label.startsWith("Address lookup")) &&
    !item.ok;
  if (!item.ok && !isOptional) failed += 1;
  const displayMark = isOptional ? "WARN" : mark;
  const suffix = item.detail ? ` — ${item.detail}` : "";
  console.log(`${displayMark}  ${item.label}${suffix}`);
}

console.log(
  failed === 0
    ? `\nAll ${checks.length} checks passed.`
    : `\n${failed}/${checks.length} checks failed (ok for local stub; required for production).`,
);

process.exit(failed === 0 ? 0 : 1);
