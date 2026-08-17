/**
 * Set studio package/gallery currency to CAD when missing or not CAD.
 *   node scripts/set-studio-currency-cad.mjs
 *
 * Uses DATABASE_URL from .env.local / env (Neon).
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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT id, slug, config_json FROM tenants`;
let updated = 0;

for (const row of rows) {
  let config;
  try {
    config =
      typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json;
  } catch {
    console.log(`SKIP ${row.slug} bad config_json`);
    continue;
  }
  const before = config?.seo?.currency ?? "(missing)";
  if (String(before).toUpperCase() === "CAD") {
    console.log(`SKIP ${row.slug} already CAD`);
    continue;
  }
  if (!config.seo) {
    config.seo = { description: "", currency: "CAD", priceRange: "$$" };
  }
  config.seo.currency = "CAD";
  await sql`
    UPDATE tenants
    SET config_json = ${JSON.stringify(config)},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${row.id}
  `;
  updated += 1;
  console.log(`UPDATED ${row.slug} ${before} -> CAD`);
}

console.log(`DONE updated=${updated} total=${rows.length}`);
