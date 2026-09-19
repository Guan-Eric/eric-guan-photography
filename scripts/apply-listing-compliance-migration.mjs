/**
 * Apply listing-compliance schema on Neon (idempotent).
 * Loads DATABASE_URL from .env.local / env.
 *
 *   node scripts/apply-listing-compliance-migration.mjs
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

const file = path.join(root, "scripts", "postgres-migrate-listing-compliance.sql");
const source = fs.readFileSync(file, "utf8");

const statements = source
  .split(/;\s*(?:\r?\n|$)/)
  .map((chunk) =>
    chunk
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const sql = neon(process.env.DATABASE_URL);

for (const [index, statement] of statements.entries()) {
  try {
    await sql.query(statement);
  } catch (error) {
    console.error(`FAILED statement ${index + 1}:\n${statement}\n`, error);
    process.exit(1);
  }
}

const columns = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'galleries' AND column_name = 'license_accepted_language')
      OR (table_name = 'media_assets' AND column_name IN (
        'enhancement_tag', 'original_disclosure_asset_id', 'disclosure_public'
      ))
      OR (table_name = 'listing_pages' AND column_name IN (
        'brokerage_phone', 'listing_status', 'advertising_ends_at', 'deed_signed_at',
        'compliance_region', 'license_display_name', 'license_type',
        'agency_legal_name', 'agency_license_type', 'alteration_disclaimer'
      ))
    )
  ORDER BY table_name, column_name
`;

console.log(
  `MIGRATION_OK ${statements.length} statements; columns: ${columns
    .map((row) => `${row.table_name}.${row.column_name}`)
    .join(", ")}`,
);
