/**
 * Rewrite tenants.config_json.siteUrl off localhost → production studio URLs.
 *
 *   node scripts/fix-tenant-site-urls.mjs
 *
 * Uses DATABASE_URL from .env.local / env.
 * Optional: PLATFORM_ROOT_DOMAIN (default studiofront.ca)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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
loadEnv(".env");

const platformRoot = (
  process.env.PLATFORM_ROOT_DOMAIN ?? "studiofront.ca"
).toLowerCase();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

if (platformRoot === "localhost" || platformRoot === "127.0.0.1") {
  console.error(
    "Refusing to run with PLATFORM_ROOT_DOMAIN=localhost. Set studiofront.ca.",
  );
  process.exit(1);
}

function isLocalhostUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(value);
  }
}

function publicUrl(slug, domain, domainStatus) {
  const live =
    Boolean(domain) &&
    (domainStatus === "active" || domainStatus === "verified");
  if (live && domain) {
    return `https://${String(domain).replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }
  return `https://${slug}.${platformRoot}`;
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT id, slug, domain, domain_status, config_json
  FROM tenants
`;

let updated = 0;
for (const row of rows) {
  let config;
  try {
    config = JSON.parse(row.config_json);
  } catch {
    console.log("SKIP_BAD_JSON=" + row.slug);
    continue;
  }
  const next = publicUrl(row.slug, row.domain, row.domain_status);
  if (config.siteUrl === next) {
    continue;
  }
  const previous = config.siteUrl;
  config.siteUrl = next;
  config.slug = row.slug;
  config.domain = row.domain;
  await sql`
    UPDATE tenants
    SET config_json = ${JSON.stringify(config)},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${row.id}
  `;
  console.log(`OK ${row.slug}: ${previous} → ${next}`);
  updated += 1;
}

console.log(`DONE updated=${updated} scanned=${rows.length}`);
