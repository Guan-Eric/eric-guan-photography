/**
 * One-time Cloudflare for SaaS setup for tenant vanity domains.
 *
 * Requires env (or .env.local):
 *   CF_SAAS_API_TOKEN     — Zone DNS Edit + SSL and Certificates Edit + Zone Read
 *   CLOUDFLARE_ZONE_ID    — studiofront.ca zone id
 *
 * Optional:
 *   CUSTOM_DOMAIN_TARGET  — default sites.studiofront.ca
 *   SAAS_FALLBACK_HOST    — default fallback.studiofront.ca
 *
 * Run: node scripts/setup-custom-domain-saas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const token = process.env.CF_SAAS_API_TOKEN?.trim();
const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
const cnameTarget = (
  process.env.CUSTOM_DOMAIN_TARGET ?? "sites.studiofront.ca"
).toLowerCase();
const fallbackHost = (
  process.env.SAAS_FALLBACK_HOST ?? "fallback.studiofront.ca"
).toLowerCase();
const zoneName = (
  process.env.PLATFORM_ROOT_DOMAIN ?? "studiofront.ca"
).toLowerCase();

if (!token || !zoneId) {
  console.error(
    "Set CF_SAAS_API_TOKEN and CLOUDFLARE_ZONE_ID before running.",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cf(method, pathName, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { response, json };
}

function recordName(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === zoneName) return "@";
  if (host.endsWith(`.${zoneName}`)) return host.slice(0, -(zoneName.length + 1));
  return host;
}

async function ensureDnsRecord({ type, name, content, proxied }) {
  const fqdn = name.includes(".") ? name : `${name}.${zoneName}`;
  const list = await cf(
    "GET",
    `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(fqdn)}`,
  );
  const existing = Array.isArray(list.json.result) ? list.json.result[0] : null;
  const payload = { type, name: recordName(fqdn), content, proxied, ttl: 1 };
  if (existing) {
    const patched = await cf(
      "PUT",
      `/zones/${zoneId}/dns_records/${existing.id}`,
      payload,
    );
    console.log(
      patched.json.success
        ? `OK DNS ${type} ${fqdn} updated`
        : `FAIL DNS update: ${JSON.stringify(patched.json.errors)}`,
    );
    return;
  }
  const created = await cf("POST", `/zones/${zoneId}/dns_records`, payload);
  console.log(
    created.json.success
      ? `OK DNS ${type} ${fqdn} created`
      : `FAIL DNS create: ${JSON.stringify(created.json.errors)}`,
  );
}

async function main() {
  console.log("Setting fallback origin DNS (dummy A, proxied)…");
  await ensureDnsRecord({
    type: "A",
    name: fallbackHost,
    content: "192.0.2.1",
    proxied: true,
  });

  console.log(`Setting customer CNAME target ${cnameTarget} → ${fallbackHost}…`);
  await ensureDnsRecord({
    type: "CNAME",
    name: cnameTarget,
    content: fallbackHost,
    proxied: true,
  });

  console.log(`Setting SaaS fallback origin to ${fallbackHost}…`);
  const fallback = await cf(
    "PUT",
    `/zones/${zoneId}/custom_hostnames/fallback_origin`,
    { origin: fallbackHost },
  );
  if (fallback.json.success) {
    console.log("OK fallback origin");
  } else {
    console.log(
      "FAIL fallback origin (enable Cloudflare for SaaS in the dashboard if needed):",
      JSON.stringify(fallback.json.errors),
    );
  }

  console.log(`
Next steps (if not already done):
1. Cloudflare Dashboard → SSL/TLS → Custom Hostnames: enable Cloudflare for SaaS.
2. Workers → studiofront → Triggers: ensure route */* on zone ${zoneName}
   (wrangler.jsonc already lists this; redeploy applies it).
3. Put secrets on the Worker:
     npx wrangler secret put CLOUDFLARE_ZONE_ID
     npx wrangler secret put CF_SAAS_API_TOKEN
4. Apply DB migration (if needed):
     node scripts/apply-custom-domain-migration.mjs
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
