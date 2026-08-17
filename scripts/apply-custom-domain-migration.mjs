/**
 * Apply custom-domain columns on Neon.
 * Loads DATABASE_URL from .env.local / env.
 *
 *   node scripts/apply-custom-domain-migration.mjs
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
await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_cf_id TEXT`;
await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_status TEXT`;
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_unique_idx
  ON tenants (domain)
  WHERE domain IS NOT NULL AND domain <> ''
`;
const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'tenants'
    AND column_name IN ('domain_cf_id', 'domain_status')
  ORDER BY column_name
`;
console.log(
  "MIGRATION_OK",
  cols.map((row) => row.column_name).join(","),
);
